import { describe, expect, it } from "vitest";
import { CostLimiter, CostLimitError, priceCall, DEFAULT_PRICING } from "../src/index.js";

describe("pricing", () => {
  it("computes cost from default pricing", () => {
    const cost = priceCall("gpt-4o-mini", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(DEFAULT_PRICING["gpt-4o-mini"]!.inputPerMTokens + DEFAULT_PRICING["gpt-4o-mini"]!.outputPerMTokens, 6);
  });

  it("returns 0 for unknown model", () => {
    expect(priceCall("not-a-real-model", 1000, 1000)).toBe(0);
  });
});

describe("CostLimiter", () => {
  it("charges and tracks per-user spend", async () => {
    const limiter = new CostLimiter({
      budgets: { perUser: { day: 1 } },
    });
    const r = await limiter.charge({
      userId: "u1",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 100_000,
      outputTokens: 100_000,
    });
    expect(r.costUsd).toBeGreaterThan(0);
    const usage = await limiter.getUsage("u1");
    expect(usage.spend.day).toBeGreaterThan(0);
  });

  it("throws CostLimitError when budget is exhausted", async () => {
    const limiter = new CostLimiter({
      budgets: { perUser: { day: 0.0001 } },
    });
    await expect(limiter.charge({
      userId: "u2",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).rejects.toThrow(CostLimitError);
  });

  it("emits BudgetWarning at threshold", async () => {
    const limiter = new CostLimiter({
      budgets: { perUser: { day: 1 } },
      warnThreshold: 0.5,
    });
    const events: unknown[] = [];
    limiter.on("BudgetWarning", (e) => events.push(e));
    await limiter.charge({
      userId: "u3",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 0,
      outputTokens: 0,
      customCostUsd: 0.6,
    });
    expect(events).toHaveLength(1);
  });

  it("resetUsage clears the user", async () => {
    const limiter = new CostLimiter({
      budgets: { perUser: { day: 10 } },
    });
    await limiter.charge({
      userId: "u4", provider: "openai", model: "gpt-4o-mini",
      inputTokens: 0, outputTokens: 0, customCostUsd: 0.5,
    });
    await limiter.resetUsage("u4");
    const usage = await limiter.getUsage("u4");
    expect(usage.spend.day).toBe(0);
  });

  it("wraps an OpenAI-like client", async () => {
    const limiter = new CostLimiter({
      budgets: { perUser: { day: 1 } },
    });
    const fakeClient = {
      chat: {
        completions: {
          async create(_req: unknown) {
            return {
              choices: [{ message: { content: "hi" } }],
              usage: { prompt_tokens: 10, completion_tokens: 10 },
              model: "gpt-4o-mini",
            };
          },
        },
      },
    };
    const wrapped = limiter.wrap(fakeClient);
    const res = await wrapped.chat.completions.create({ userId: "u5", model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] } as any);
    expect(res.choices[0]!.message.content).toBe("hi");
    const usage = await limiter.getUsage("u5");
    expect(usage.spend.day).toBeGreaterThan(0);
  });
});
