import { describe, expect, it } from "vitest";
import {
  Analyzer,
  extractFilterFields,
  fingerprintFilter,
  fingerprintQuery,
  indexCoversFields,
  isFullScan,
  suggestCompoundIndex,
  formatWarning,
  formatStats,
} from "../src/index.js";
import type { QueryEvent } from "../src/index.js";

function makeQuery(overrides: Partial<QueryEvent> = {}): QueryEvent {
  return {
    id: "q",
    model: "User",
    collection: "users",
    op: "find",
    filter: {},
    fields: [],
    options: {},
    startedAt: Date.now(),
    durationMs: 10,
    resultCount: 1,
    ...overrides,
  };
}

describe("extractFilterFields", () => {
  it("collects top-level fields", () => {
    expect(extractFilterFields({ a: 1, b: 2 })).toEqual(["a", "b"]);
  });
  it("ignores operators and walks $or", () => {
    expect(extractFilterFields({ $or: [{ a: 1 }, { b: 2 }], c: 3 }).sort())
      .toEqual(["a", "b", "c"]);
  });
  it("keeps operator-typed leaves", () => {
    expect(extractFilterFields({ age: { $gt: 1 } })).toEqual(["age"]);
  });
});

describe("fingerprintFilter / fingerprintQuery", () => {
  it("normalises values to their shape", () => {
    expect(fingerprintFilter({ a: 1, b: "x" })).toBe(fingerprintFilter({ a: 9, b: "y" }));
  });
  it("differentiates ops/collections", () => {
    const a = fingerprintQuery("find", "users", { id: 1 });
    const b = fingerprintQuery("findOne", "users", { id: 1 });
    expect(a).not.toBe(b);
  });
});

describe("index analysis", () => {
  it("detects covered fields", () => {
    expect(indexCoversFields(["a"], [{ fields: ["a"] }])).toBe(true);
    expect(indexCoversFields(["a", "b"], [{ fields: ["a"] }])).toBe(false);
  });
  it("recognises empty filter as full scan", () => {
    expect(isFullScan({})).toBe(true);
    expect(isFullScan({ a: 1 })).toBe(false);
  });
  it("suggests sorted compound index", () => {
    expect(suggestCompoundIndex(["b", "a"]).fields).toEqual(["a", "b"]);
  });
});

describe("Analyzer", () => {
  it("emits slow-query warnings", () => {
    const a = new Analyzer({ slowQueryThreshold: 100 });
    const w = a.observe(makeQuery({ durationMs: 250, filter: { id: 1 } }));
    expect(w.some((x) => x.kind === "slow-query")).toBe(true);
  });

  it("emits full-scan warning", () => {
    const a = new Analyzer();
    const w = a.observe(makeQuery({ filter: {} }));
    expect(w.some((x) => x.kind === "full-collection-scan")).toBe(true);
  });

  it("emits missing-index warning when indexes are registered", () => {
    const a = new Analyzer();
    a.registerIndexes("users", [{ fields: ["email"] }]);
    const w = a.observe(makeQuery({ filter: { username: "foo" } }));
    expect(w.find((x) => x.kind === "missing-index")).toBeTruthy();
  });

  it("does not emit missing-index when covered", () => {
    const a = new Analyzer();
    a.registerIndexes("users", [{ fields: ["email"] }]);
    const w = a.observe(makeQuery({ filter: { email: "x@y.z" } }));
    expect(w.find((x) => x.kind === "missing-index")).toBeFalsy();
  });

  it("detects duplicates within window", () => {
    const a = new Analyzer({ duplicateThreshold: 3, duplicateWindowMs: 1000 });
    const filter = { id: 1 };
    for (let i = 0; i < 3; i++) a.observe(makeQuery({ filter, startedAt: 1000 + i }));
    const stats = a.stats();
    expect(stats.warnings["duplicate-query"]).toBeGreaterThan(0);
  });

  it("escalates duplicates to n-plus-one", () => {
    const a = new Analyzer({ duplicateThreshold: 3, duplicateWindowMs: 1000 });
    let lastKind = "";
    for (let i = 0; i < 7; i++) {
      const w = a.observe(makeQuery({ filter: { id: 1 }, startedAt: 1000 + i }));
      const found = w.find((x) => x.kind === "n-plus-one" || x.kind === "duplicate-query");
      if (found) lastKind = found.kind;
    }
    expect(lastKind).toBe("n-plus-one");
  });

  it("flags large results", () => {
    const a = new Analyzer({ largeResultThreshold: 100 });
    const w = a.observe(makeQuery({ resultCount: 250, filter: { id: 1 } }));
    expect(w.find((x) => x.kind === "large-result")).toBeTruthy();
  });

  it("analyzes aggregation pipeline order", () => {
    const a = new Analyzer();
    const w = a.observe(
      makeQuery({
        op: "aggregate",
        pipeline: [
          { $sort: { createdAt: -1 } },
          { $match: { active: true } },
        ],
      }),
    );
    expect(w.find((x) => x.kind === "aggregation-bottleneck")).toBeTruthy();
  });

  it("warns on sort without limit", () => {
    const a = new Analyzer();
    const w = a.observe(
      makeQuery({
        op: "aggregate",
        pipeline: [{ $match: { x: 1 } }, { $sort: { a: 1 } }],
      }),
    );
    expect(w.find((x) => x.kind === "aggregation-bottleneck")).toBeTruthy();
  });

  it("collects stats and resets", () => {
    const a = new Analyzer();
    a.observe(makeQuery({ durationMs: 500, filter: { id: 1 } }));
    let s = a.stats();
    expect(s.totalQueries).toBe(1);
    expect(s.slowQueries).toBeGreaterThanOrEqual(1);
    a.reset();
    s = a.stats();
    expect(s.totalQueries).toBe(0);
  });
});

describe("formatters", () => {
  it("formatWarning produces multi-line text", () => {
    const a = new Analyzer();
    const w = a.observe(makeQuery({ durationMs: 500, filter: { id: 1 } }))[0]!;
    const out = formatWarning(w);
    expect(out).toMatch(/monguard/);
    expect(out).toMatch(/op=find/);
  });
  it("formatStats includes counts", () => {
    const a = new Analyzer();
    a.observe(makeQuery({ filter: { x: 1 } }));
    expect(formatStats(a.stats())).toMatch(/queries: 1/);
  });
});
