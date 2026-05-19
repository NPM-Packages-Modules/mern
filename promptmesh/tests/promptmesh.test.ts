import { describe, expect, it } from "vitest";
import {
  PromptMesh,
  PromptRegistry,
  MemoryCache,
  extractVariables,
  renderTemplate,
  hashPrompt,
  pickVariant,
  stableHash,
} from "../src/index.js";

describe("template", () => {
  it("extracts {{ var }} placeholders", () => {
    expect(extractVariables("Hello {{name}}, you are {{age}}.").sort()).toEqual(["age", "name"]);
  });
  it("renders nested paths", () => {
    expect(renderTemplate("Hi {{user.name}}", { user: { name: "A" } })).toBe("Hi A");
  });
  it("throws on missing variables", () => {
    expect(() => renderTemplate("{{x}}", {})).toThrow(/Missing template variable/);
  });
});

describe("hash", () => {
  it("hashPrompt is stable for the same input", () => {
    const m = [{ role: "system" as const, content: "hi" }];
    expect(hashPrompt("a", "1", m, { x: 1 })).toBe(hashPrompt("a", "1", m, { x: 1 }));
  });
  it("hashPrompt differs across versions", () => {
    const m = [{ role: "system" as const, content: "hi" }];
    expect(hashPrompt("a", "1", m, {})).not.toBe(hashPrompt("a", "2", m, {}));
  });
  it("stableHash is deterministic", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
  });
});

describe("MemoryCache", () => {
  it("stores and retrieves values", () => {
    const c = new MemoryCache<string>();
    c.set("k", "v");
    expect(c.get("k")?.value).toBe("v");
  });
  it("respects TTL", async () => {
    const c = new MemoryCache<string>();
    c.set("k", "v", 10);
    await new Promise((r) => setTimeout(r, 25));
    expect(c.get("k")).toBeUndefined();
  });
  it("evicts oldest beyond maxEntries", () => {
    const c = new MemoryCache<string>({ maxEntries: 2 });
    c.set("a", "1");
    c.set("b", "2");
    c.set("c", "3");
    expect(c.size()).toBe(2);
    expect(c.get("a")).toBeUndefined();
  });
});

describe("PromptRegistry", () => {
  it("registers versioned prompts", () => {
    const r = new PromptRegistry();
    r.register({ name: "p", version: "1", messages: [{ role: "system", content: "hi" }] });
    r.register({ name: "p", version: "2", messages: [{ role: "system", content: "hi {{x}}" }] });
    expect(r.versions("p")).toEqual(["1", "2"]);
    expect(r.get("p").version).toBe("2");
    expect(r.get("p", "1").version).toBe("1");
  });
  it("throws on duplicate version", () => {
    const r = new PromptRegistry();
    r.register({ name: "p", version: "1", messages: [{ role: "system", content: "x" }] });
    expect(() =>
      r.register({ name: "p", version: "1", messages: [{ role: "system", content: "y" }] }),
    ).toThrow();
  });
  it("extracts variables on registration", () => {
    const r = new PromptRegistry();
    const v = r.register({
      name: "p",
      version: "1",
      messages: [{ role: "user", content: "Hello {{a}} and {{b}}" }],
    });
    expect(v.variables.sort()).toEqual(["a", "b"]);
  });
});

describe("pickVariant", () => {
  it("distributes per weight (deterministic per seed)", () => {
    const config = {
      variants: [
        { name: "A", weight: 1, version: "1" },
        { name: "B", weight: 1, version: "2" },
      ],
    };
    expect(pickVariant(config, "user-1")).toEqual(pickVariant(config, "user-1"));
    const sample = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(config, `u${i}`);
      sample.set(v.name, (sample.get(v.name) ?? 0) + 1);
    }
    expect(sample.get("A")! + sample.get("B")!).toBe(1000);
    expect(sample.get("A")).toBeGreaterThan(200);
    expect(sample.get("B")).toBeGreaterThan(200);
  });
});

describe("PromptMesh.run", () => {
  it("renders, caches, and executes via provider", async () => {
    const mesh = new PromptMesh<string>();
    mesh.register({
      name: "greet",
      version: "1",
      messages: [{ role: "user", content: "Say hi to {{name}}." }],
    });
    let providerCalls = 0;
    const r1 = await mesh.run("greet", {
      variables: { name: "Alice" },
      provider: async () => {
        providerCalls += 1;
        return "Hi Alice";
      },
    });
    expect(r1.response).toBe("Hi Alice");
    expect(r1.cached).toBe(false);
    const r2 = await mesh.run("greet", {
      variables: { name: "Alice" },
      provider: async () => {
        providerCalls += 1;
        return "Hi Alice";
      },
    });
    expect(r2.cached).toBe(true);
    expect(providerCalls).toBe(1);
  });

  it("falls back when first provider fails", async () => {
    const mesh = new PromptMesh<string>();
    mesh.register({ name: "p", version: "1", messages: [{ role: "user", content: "x" }] });
    const result = await mesh.run("p", {
      provider: async () => { throw new Error("nope"); },
      fallbacks: [async () => "fallback"],
    });
    expect(result.response).toBe("fallback");
    expect(result.attempts).toBe(2);
    expect(result.errors?.[0]).toMatch(/nope/);
  });

  it("throws when all providers fail", async () => {
    const mesh = new PromptMesh<string>();
    mesh.register({ name: "p", version: "1", messages: [{ role: "user", content: "x" }] });
    await expect(
      mesh.run("p", {
        provider: async () => { throw new Error("a"); },
        fallbacks: [async () => { throw new Error("b"); }],
      }),
    ).rejects.toThrow(/All providers failed/);
  });

  it("supports A/B experiments", async () => {
    const mesh = new PromptMesh<string>();
    mesh.register({ name: "p", version: "v1", messages: [{ role: "user", content: "A {{x}}" }] });
    mesh.register({ name: "p", version: "v2", messages: [{ role: "user", content: "B {{x}}" }] });
    mesh.experiment("p", {
      variants: [
        { name: "control", weight: 1, version: "v1" },
        { name: "test", weight: 1, version: "v2" },
      ],
    });
    const rendered = mesh.render("p", { variables: { x: "1" } });
    expect(["v1", "v2"]).toContain(rendered.version);
    expect(["control", "test"]).toContain(rendered.variant);
  });

  it("collects analytics", async () => {
    const mesh = new PromptMesh<string>();
    mesh.register({ name: "p", version: "1", messages: [{ role: "user", content: "hi" }] });
    await mesh.run("p", { provider: async () => "x" });
    await mesh.run("p", { provider: async () => "x" });
    const s = mesh.stats();
    expect(s.totalCalls).toBe(2);
    expect(s.cacheHits).toBe(1);
    expect(s.cacheMisses).toBe(1);
  });
});
