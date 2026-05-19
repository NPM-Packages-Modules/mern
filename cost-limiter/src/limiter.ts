import { EventEmitter } from "node:events";
import { CostLimitError } from "./errors.js";
import { DEFAULT_PRICING, priceCall, type ModelPrice } from "./pricing.js";
import {
  MemoryCostStorage,
  type StorageAdapter,
  WINDOWS,
  windowBucket,
  windowResetAt,
} from "./storage.js";
import type {
  BudgetConfig,
  BudgetWarningEvent,
  Dimension,
  UsageReport,
  Window,
  WindowBudget,
} from "./types.js";

export interface CostLimiterOptions {
  budgets?: BudgetConfig;
  storage?: StorageAdapter;
  pricing?: Record<string, ModelPrice> | "auto";
  /** Soft-warn threshold (0-1). Defaults to 0.8 (80%). */
  warnThreshold?: number;
}

export interface ChargeInput {
  userId?: string;
  teamId?: string;
  apiKeyId?: string;
  provider: "openai" | "anthropic" | string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  customCostUsd?: number;
}

const DIMENSION_PREFIX: Record<"user" | "team" | "apiKey" | "global", string> = {
  user: "u",
  team: "t",
  apiKey: "k",
  global: "g",
};

export class CostLimiter extends EventEmitter {
  readonly storage: StorageAdapter;
  readonly budgets: BudgetConfig;
  readonly pricing: Record<string, ModelPrice>;
  readonly warnThreshold: number;

  constructor(opts: CostLimiterOptions = {}) {
    super();
    this.storage = opts.storage ?? new MemoryCostStorage();
    this.budgets = opts.budgets ?? {};
    this.pricing = opts.pricing === "auto" || !opts.pricing ? DEFAULT_PRICING : opts.pricing;
    this.warnThreshold = opts.warnThreshold ?? 0.8;
  }

  private dimensionKey(dim: keyof typeof DIMENSION_PREFIX, key: string): string {
    return `${DIMENSION_PREFIX[dim]}:${key}`;
  }

  private checks(input: ChargeInput): { dim: keyof typeof DIMENSION_PREFIX; key: string; budget: WindowBudget }[] {
    const out: { dim: keyof typeof DIMENSION_PREFIX; key: string; budget: WindowBudget }[] = [];
    if (input.userId && this.budgets.perUser) out.push({ dim: "user", key: input.userId, budget: this.budgets.perUser });
    if (input.teamId && this.budgets.perTeam) out.push({ dim: "team", key: input.teamId, budget: this.budgets.perTeam });
    if (input.apiKeyId && this.budgets.perApiKey) out.push({ dim: "apiKey", key: input.apiKeyId, budget: this.budgets.perApiKey });
    if (this.budgets.global) out.push({ dim: "global", key: "global", budget: this.budgets.global });
    return out;
  }

  /** Throws CostLimitError when any *remaining* budget can not absorb `costUsd`. */
  async check(input: Omit<ChargeInput, "outputTokens"> & { estimatedCostUsd?: number }): Promise<void> {
    const cost = input.estimatedCostUsd ?? 0;
    const now = new Date();
    for (const c of this.checks({ ...input, outputTokens: 0 })) {
      for (const w of WINDOWS) {
        const limit = c.budget[w];
        if (limit === undefined) continue;
        const fullKey = `${this.dimensionKey(c.dim, c.key)}:${windowBucket(now, w)}`;
        const used = await this.storage.get(fullKey, w);
        if (used + cost > limit) {
          throw new CostLimitError({
            limit,
            used,
            resetAt: windowResetAt(now, w),
            window: w,
            dimension: c.dim,
            dimensionKey: c.key,
          });
        }
      }
    }
  }

  async charge(input: ChargeInput): Promise<{ costUsd: number }> {
    const costUsd = input.customCostUsd ?? priceCall(input.model, input.inputTokens, input.outputTokens, this.pricing);
    const now = new Date();
    for (const c of this.checks(input)) {
      for (const w of WINDOWS) {
        const limit = c.budget[w];
        if (limit === undefined) continue;
        const bucket = windowBucket(now, w);
        const fullKey = `${this.dimensionKey(c.dim, c.key)}:${bucket}`;
        const newTotal = await this.storage.increment(fullKey, costUsd, w, windowResetAt(now, w));
        if (newTotal > limit) {
          throw new CostLimitError({
            limit,
            used: newTotal,
            resetAt: windowResetAt(now, w),
            window: w,
            dimension: c.dim,
            dimensionKey: c.key,
          });
        }
        if (newTotal / limit >= this.warnThreshold) {
          const ev: BudgetWarningEvent = {
            dimension: c.dim,
            key: c.key,
            window: w,
            used: newTotal,
            limit,
            percent: newTotal / limit,
          };
          this.emit("BudgetWarning", ev);
        }
      }
    }
    return { costUsd };
  }

  async getUsage(userId: string): Promise<UsageReport> {
    const now = new Date();
    const spend: Record<Window, number> = { minute: 0, hour: 0, day: 0, month: 0 };
    const limit: Record<Window, number | undefined> = { minute: undefined, hour: undefined, day: undefined, month: undefined };
    for (const w of WINDOWS) {
      const key = `${this.dimensionKey("user", userId)}:${windowBucket(now, w)}`;
      spend[w] = await this.storage.get(key, w);
      limit[w] = this.budgets.perUser?.[w];
    }
    return { dimension: "user", key: userId, spend, limit };
  }

  async resetUsage(userId: string): Promise<void> {
    const now = new Date();
    for (const w of WINDOWS) {
      const key = `${this.dimensionKey("user", userId)}:${windowBucket(now, w)}`;
      await this.storage.reset(key);
    }
  }

  /** Wrap an OpenAI v4 client so usage is charged automatically. */
  wrap<T extends OpenAILike>(client: T, ctx?: { provider?: "openai" }): T {
    return new Proxy(client, this.makeHandler("openai")) as T;
  }

  /** Wrap an Anthropic SDK client. */
  wrapAnthropic<T extends AnthropicLike>(client: T): T {
    return new Proxy(client, this.makeHandler("anthropic")) as T;
  }

  /** Express/Hono/Fastify-style middleware: parses `userId`/`teamId` off `req` before allowing the request. */
  middleware(getDims: (req: unknown) => { userId?: string; teamId?: string; apiKeyId?: string; estimatedCostUsd?: number }) {
    return async (req: unknown, _res: unknown, next: (err?: unknown) => void) => {
      try {
        const { estimatedCostUsd, ...dims } = getDims(req);
        await this.check({
          ...dims,
          provider: "openai",
          model: "gpt-4o-mini",
          inputTokens: 0,
          ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
        });
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  private makeHandler(provider: "openai" | "anthropic"): ProxyHandler<object> {
    const limiter = this;
    const handler: ProxyHandler<object> = {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "object" && value !== null) {
          return new Proxy(value, handler);
        }
        if (typeof value === "function") {
          return async (req: Record<string, unknown> & { userId?: string; teamId?: string; apiKeyId?: string; model?: string }) => {
            const result = await (value as Function).call(target, stripDims(req));
            try {
              const usage = extractUsage(result, provider);
              if (usage) {
                await limiter.charge({
                  ...(req.userId !== undefined ? { userId: req.userId } : {}),
                  ...(req.teamId !== undefined ? { teamId: req.teamId } : {}),
                  ...(req.apiKeyId !== undefined ? { apiKeyId: req.apiKeyId } : {}),
                  provider,
                  model: String(req.model ?? usage.model ?? "unknown"),
                  inputTokens: usage.input,
                  outputTokens: usage.output,
                });
              }
            } catch (err) {
              if (err instanceof CostLimitError) throw err;
            }
            return result;
          };
        }
        return value;
      },
    };
    return handler;
  }
}

interface OpenAILike { chat?: unknown }
interface AnthropicLike { messages?: unknown }

function stripDims<T extends Record<string, unknown>>(req: T): Omit<T, "userId" | "teamId" | "apiKeyId"> {
  const { userId: _u, teamId: _t, apiKeyId: _k, ...rest } = req;
  return rest as Omit<T, "userId" | "teamId" | "apiKeyId">;
}

function extractUsage(result: unknown, provider: "openai" | "anthropic"): { input: number; output: number; model?: string } | undefined {
  const r = result as { usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number }; model?: string } | null;
  if (!r?.usage) return undefined;
  if (provider === "openai") {
    return {
      input: r.usage.prompt_tokens ?? 0,
      output: r.usage.completion_tokens ?? 0,
      ...(r.model ? { model: r.model } : {}),
    };
  }
  return {
    input: r.usage.input_tokens ?? 0,
    output: r.usage.output_tokens ?? 0,
    ...(r.model ? { model: r.model } : {}),
  };
}
