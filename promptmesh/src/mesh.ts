import { MemoryCache } from "./cache.js";
import { pickVariant } from "./experiment.js";
import { hashPrompt } from "./hash.js";
import { PromptRegistry, type PromptRegistration } from "./registry.js";
import { renderTemplate } from "./template.js";
import type {
  CacheStore,
  PromptMessage,
  PromptVersion,
  Provider,
  RenderInput,
  RenderedPrompt,
  RunOptions,
  RunRecord,
  MeshAnalytics,
} from "./types.js";

export interface MeshOptions<TResponse> {
  cache?: CacheStore<TResponse>;
  defaultProvider?: Provider<TResponse>;
}

export class PromptMesh<TResponse = string> {
  private registry = new PromptRegistry();
  private cache: CacheStore<TResponse>;
  private analytics: MeshAnalytics = {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    byVariant: {},
  };
  private defaultProvider?: Provider<TResponse>;

  constructor(options: MeshOptions<TResponse> = {}) {
    this.cache = options.cache ?? new MemoryCache<TResponse>();
    this.defaultProvider = options.defaultProvider;
  }

  register(reg: PromptRegistration): PromptVersion {
    return this.registry.register(reg);
  }

  experiment(name: string, config: Parameters<PromptRegistry["setExperiment"]>[1]): void {
    this.registry.setExperiment(name, config);
  }

  versions(name: string): string[] {
    return this.registry.versions(name);
  }

  render(name: string, input: RenderInput = {}): RenderedPrompt {
    const exp = this.registry.experiment(name);
    let version = input.version;
    let variantName: string | undefined = input.variant;
    if (!version && exp) {
      const variant = pickVariant(exp, JSON.stringify(input.variables ?? {}) + (input.tags?.join(",") ?? ""));
      version = variant.version;
      variantName = variant.name;
    }
    const promptVersion = this.registry.get(name, version);
    const variables = input.variables ?? {};
    const renderedMessages: PromptMessage[] = promptVersion.messages.map((m) => ({
      role: m.role,
      content: renderTemplate(m.content, variables),
    }));
    const hash = hashPrompt(name, promptVersion.version, renderedMessages, variables);
    return {
      name,
      version: promptVersion.version,
      variant: variantName,
      messages: renderedMessages,
      hash,
      meta: promptVersion.metadata,
    };
  }

  async run(name: string, options: RunOptions<TResponse> = {}): Promise<RunRecord<TResponse>> {
    const startedAt = Date.now();
    this.analytics.totalCalls += 1;

    const rendered = this.render(name, {
      variables: options.variables,
      tags: options.tags,
    });

    const cacheKey = options.cacheKey ?? rendered.hash;
    if (!options.bypassCache) {
      const hit = this.cache.get(cacheKey);
      if (hit) {
        this.analytics.cacheHits += 1;
        this.recordVariant(rendered, Date.now() - startedAt);
        return {
          prompt: rendered,
          cached: true,
          response: hit.value,
          attempts: 0,
          durationMs: Date.now() - startedAt,
        };
      }
      this.analytics.cacheMisses += 1;
    }

    const providers: Array<Provider<TResponse>> = [];
    if (options.provider) providers.push(options.provider);
    else if (this.defaultProvider) providers.push(this.defaultProvider);
    providers.push(...(options.fallbacks ?? []));

    if (providers.length === 0) {
      this.analytics.errors += 1;
      throw new Error(`No provider configured for prompt ${name}`);
    }

    const errors: string[] = [];
    let attempts = 0;
    for (const provider of providers) {
      attempts += 1;
      try {
        const result = await provider(rendered, { variables: options.variables ?? {} });
        if (!options.bypassCache) this.cache.set(cacheKey, result, options.cacheTtlMs);
        this.recordVariant(rendered, Date.now() - startedAt);
        return {
          prompt: rendered,
          cached: false,
          response: result,
          attempts,
          durationMs: Date.now() - startedAt,
          errors: errors.length ? errors : undefined,
        };
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    this.analytics.errors += 1;
    throw new Error(`All providers failed for prompt ${name}: ${errors.join(" | ")}`);
  }

  private recordVariant(rendered: RenderedPrompt, durationMs: number): void {
    const key = rendered.variant ?? rendered.version;
    const stat = this.analytics.byVariant[key] ?? {
      calls: 0,
      latencyMsSum: 0,
      avgLatencyMs: 0,
    };
    stat.calls += 1;
    stat.latencyMsSum += durationMs;
    stat.avgLatencyMs = stat.latencyMsSum / stat.calls;
    this.analytics.byVariant[key] = stat;
  }

  stats(): MeshAnalytics {
    return JSON.parse(JSON.stringify(this.analytics)) as MeshAnalytics;
  }

  resetAnalytics(): void {
    this.analytics = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      byVariant: {},
    };
  }
}
