import { describe, expect, it } from "vitest";
import { monguard } from "../src/index.js";

interface FakeQuery {
  op: string;
  filter: Record<string, unknown>;
  getFilter(): Record<string, unknown>;
  getOptions(): Record<string, unknown>;
  selected(): undefined;
  model: { modelName: string; collection: { name: string } };
  options?: Record<string, unknown>;
  _monguardStart?: number;
  _monguardId?: string;
  _monguardOp?: string;
  _monguardCollection?: string;
  _monguardFilter?: Record<string, unknown>;
  _monguardOptions?: Record<string, unknown>;
  _monguardFields?: string[];
  _monguardStack?: string;
}

interface FakeSchema {
  preHooks: Map<string, Array<(this: unknown) => void>>;
  postHooks: Map<string, Array<(this: unknown, result: unknown) => void>>;
  pre(hook: string, fn: (this: unknown) => void): FakeSchema;
  post(hook: string, fn: (this: unknown, result: unknown) => void): FakeSchema;
  indexes(): unknown[];
  options: { collection: string };
  modelName: string;
}

function makeSchema(indexes: Array<[Record<string, 1>, Record<string, unknown>?]> = []): FakeSchema {
  const preHooks = new Map<string, Array<(this: unknown) => void>>();
  const postHooks = new Map<string, Array<(this: unknown, result: unknown) => void>>();
  const schema: FakeSchema = {
    preHooks,
    postHooks,
    pre(hook, fn) {
      const arr = preHooks.get(hook) ?? [];
      arr.push(fn);
      preHooks.set(hook, arr);
      return schema;
    },
    post(hook, fn) {
      const arr = postHooks.get(hook) ?? [];
      arr.push(fn);
      postHooks.set(hook, arr);
      return schema;
    },
    indexes() {
      return indexes;
    },
    options: { collection: "users" },
    modelName: "User",
  };
  return schema;
}

function makeQuery(op: string, filter: Record<string, unknown>): FakeQuery {
  return {
    op,
    filter,
    getFilter() { return filter; },
    getOptions() { return {}; },
    selected() { return undefined; },
    model: { modelName: "User", collection: { name: "users" } },
  };
}

function runQuery(schema: FakeSchema, query: FakeQuery, result: unknown): void {
  const pre = schema.preHooks.get(query.op) ?? [];
  for (const fn of pre) fn.call(query);
  const post = schema.postHooks.get(query.op) ?? [];
  for (const fn of post) fn.call(query, result);
}

describe("mongoose plugin", () => {
  it("captures queries and emits warnings", () => {
    const handle = monguard({ slowQueryThreshold: 1, silent: true });
    const schema = makeSchema([[{ email: 1 }]]);
    handle.plugin(schema);
    const q = makeQuery("find", { username: "alice" });
    runQuery(schema, q, [{ id: 1 }]);
    const stats = handle.stats();
    expect(stats.totalQueries).toBe(1);
    expect(stats.warnings["missing-index"]).toBe(1);
  });

  it("triggers onWarning handlers", () => {
    const handle = monguard({ slowQueryThreshold: 1, silent: true });
    const seen: string[] = [];
    handle.onWarning((w) => seen.push(w.kind));
    const schema = makeSchema();
    handle.plugin(schema);
    runQuery(schema, makeQuery("findOne", {}), null);
    expect(seen).toContain("full-collection-scan");
  });

  it("captures aggregations", () => {
    const handle = monguard({ silent: true });
    const schema = makeSchema();
    handle.plugin(schema);
    const agg = {
      pipeline() { return [{ $sort: { x: 1 } }]; },
      model() { return { modelName: "User", collection: { name: "users" } }; },
      options: {},
    } as unknown as FakeQuery;
    const pre = schema.preHooks.get("aggregate") ?? [];
    const post = schema.postHooks.get("aggregate") ?? [];
    for (const fn of pre) fn.call(agg);
    for (const fn of post) fn.call(agg, [{ x: 1 }]);
    expect(handle.stats().totalQueries).toBe(1);
  });

  it("respects silent mode (no console)", () => {
    const lines: string[] = [];
    const handle = monguard({
      silent: false,
      logger: (l) => lines.push(l),
      slowQueryThreshold: 1,
    });
    const schema = makeSchema();
    handle.plugin(schema);
    runQuery(schema, makeQuery("find", {}), [1, 2, 3]);
    expect(lines.length).toBeGreaterThan(0);
  });
});
