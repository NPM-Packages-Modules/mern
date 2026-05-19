import { describe, expect, it } from "vitest";
import { PromptForge, MemoryStorage, PromptExperiment, hashToUnit, PromptNotFoundError } from "../src/index.js";

describe("PromptForge", () => {
  it("creates, loads, lists, and rolls back prompts", async () => {
    const forge = new PromptForge({ storage: new MemoryStorage() });
    await forge.init();
    await forge.create("summarize", "Summarize: {{text}}", { model: "gpt-4o-mini" });
    await forge.create("summarize", "Summarize concisely: {{text}}");

    const v2 = await forge.load("summarize");
    expect(v2.version).toBe(2);

    await forge.rollback("summarize", 1);
    const back = await forge.load("summarize");
    expect(back.version).toBe(1);
    expect(back.model).toBe("gpt-4o-mini");

    const all = await forge.list();
    expect(all).toHaveLength(1);
    expect(all[0]!.versions).toEqual([1, 2]);
  });

  it("throws PromptNotFoundError for unknown prompts", async () => {
    const forge = new PromptForge({ storage: new MemoryStorage() });
    await expect(forge.load("missing")).rejects.toThrow(PromptNotFoundError);
  });

  it("renders templates with vars", async () => {
    const forge = new PromptForge({ storage: new MemoryStorage() });
    await forge.create("greet", "Hello, {{user.name}}!");
    expect(await forge.render("greet", { user: { name: "Ada" } })).toBe("Hello, Ada!");
  });
});

describe("PromptExperiment", () => {
  it("assigns deterministically by userKey", () => {
    const exp = new PromptExperiment({
      id: "exp1",
      variants: [
        { name: "A", promptName: "p", weight: 50 },
        { name: "B", promptName: "p", weight: 50 },
      ],
    });
    const a = exp.assign("user-42");
    const b = exp.assign("user-42");
    expect(a.name).toBe(b.name);
  });

  it("respects weights approximately over many users", () => {
    const exp = new PromptExperiment({
      id: "exp2",
      variants: [
        { name: "A", promptName: "p", weight: 70 },
        { name: "B", promptName: "p", weight: 30 },
      ],
    });
    let countA = 0;
    for (let i = 0; i < 5000; i++) {
      if (exp.assign(`u-${i}`).name === "A") countA += 1;
    }
    const ratio = countA / 5000;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.75);
  });

  it("computes a winner by cost", () => {
    const exp = new PromptExperiment({
      id: "exp3",
      variants: [
        { name: "A", promptName: "p", weight: 50 },
        { name: "B", promptName: "p", weight: 50 },
      ],
    });
    exp.record({ variantName: "A", latencyMs: 100, costUsd: 0.01, inputTokens: 10, outputTokens: 10 });
    exp.record({ variantName: "B", latencyMs: 100, costUsd: 0.001, inputTokens: 10, outputTokens: 10 });
    expect(exp.getWinner("cost").name).toBe("B");
  });

  it("computes winner by custom metric (higher is better)", () => {
    const exp = new PromptExperiment({
      id: "exp4",
      variants: [
        { name: "A", promptName: "p", weight: 50 },
        { name: "B", promptName: "p", weight: 50 },
      ],
    });
    exp.record({ variantName: "A", latencyMs: 100, costUsd: 0.01, inputTokens: 1, outputTokens: 1, custom: { thumbsUp: 1 } });
    exp.record({ variantName: "B", latencyMs: 100, costUsd: 0.01, inputTokens: 1, outputTokens: 1, custom: { thumbsUp: 5 } });
    expect(exp.getWinner("thumbsUp").name).toBe("B");
  });

  it("hashToUnit is in [0, 1) and deterministic", () => {
    const a = hashToUnit("seed");
    const b = hashToUnit("seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
});
