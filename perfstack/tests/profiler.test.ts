import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  Profiler,
  Histogram,
  Tracer,
  init,
  expressMiddleware,
  dashboardMiddleware,
  percentile,
} from "../src/index.js";

describe("Histogram", () => {
  it("computes percentiles", () => {
    const h = new Histogram();
    for (let i = 1; i <= 100; i++) h.record(i);
    const s = h.summary();
    expect(s.count).toBe(100);
    expect(s.min).toBe(1);
    expect(s.max).toBe(100);
    expect(s.p50).toBeGreaterThanOrEqual(50);
    expect(s.p95).toBeGreaterThanOrEqual(95);
  });
  it("percentile of empty is 0", () => {
    expect(percentile([], 0.5)).toBe(0);
  });
  it("handles single sample", () => {
    const h = new Histogram();
    h.record(42);
    expect(h.summary().avg).toBe(42);
  });
});

describe("Tracer", () => {
  it("creates and ends spans", () => {
    const t = new Tracer();
    const span = t.start("op", "custom", { foo: "bar" });
    const ended = span.end();
    expect(ended.name).toBe("op");
    expect(ended.status).toBe("ok");
    expect(ended.metadata.foo).toBe("bar");
  });
  it("captures errors via withSpan", async () => {
    const t = new Tracer();
    await expect(
      t.withSpan("bad", async () => { throw new Error("x"); }),
    ).rejects.toThrow();
    const last = t.recent().at(-1)!;
    expect(last.status).toBe("error");
    expect(last.error).toBe("x");
  });
  it("propagates trace context", () => {
    const t = new Tracer();
    let inner: string | undefined;
    t.runInContext("t1", () => {
      inner = t.currentTraceId();
    });
    expect(inner).toBe("t1");
  });
});

describe("Profiler", () => {
  it("records HTTP and computes route summary", () => {
    const p = new Profiler();
    p.recordHttp({ method: "GET", path: "/x", statusCode: 200, durationMs: 100, startedAt: 0, traceId: "t" });
    p.recordHttp({ method: "GET", path: "/x", statusCode: 500, durationMs: 400, startedAt: 0, traceId: "t" });
    const r = p.report();
    expect(r.totalRequests).toBe(2);
    expect(r.totalErrors).toBe(1);
    const route = r.routes.find((x) => x.path === "/x")!;
    expect(route.count).toBe(2);
    expect(route.errorCount).toBe(1);
  });
  it("tracks slow queries", () => {
    const p = new Profiler({ slowQueryThreshold: 100 });
    p.recordQuery({ collection: "u", op: "find", durationMs: 50, startedAt: 0 });
    p.recordQuery({ collection: "u", op: "find", durationMs: 250, startedAt: 0 });
    const r = p.report();
    expect(r.totalQueries).toBe(2);
    expect(r.slowestQueries).toHaveLength(1);
    expect(r.slowestQueries[0]!.durationMs).toBe(250);
  });
  it("takes memory snapshots", () => {
    const p = new Profiler();
    const snap = p.takeMemorySample();
    expect(snap.rss).toBeGreaterThan(0);
    expect(snap.heapUsed).toBeGreaterThan(0);
    const r = p.report();
    expect(r.memory.peakRss).toBeGreaterThan(0);
  });
});

describe("Express integration", () => {
  it("records requests via middleware", async () => {
    const p = new Profiler();
    const app = express();
    app.use(expressMiddleware(p));
    app.get("/x", (_req, res) => res.json({ ok: true }));
    await request(app).get("/x");
    const r = p.report();
    expect(r.totalRequests).toBe(1);
  });
  it("serves JSON dashboard", async () => {
    const p = new Profiler();
    const app = express();
    app.use(expressMiddleware(p));
    app.get("/__perf.json", dashboardMiddleware(p) as any);
    app.get("/x", (_req, res) => res.json({ ok: true }));
    await request(app).get("/x");
    const res = await request(app).get("/__perf.json");
    expect(res.status).toBe(200);
    expect(res.body.totalRequests).toBe(1);
  });
  it("serves HTML dashboard", async () => {
    const p = new Profiler();
    const app = express();
    app.use(expressMiddleware(p));
    app.get("/__perf", dashboardMiddleware(p) as any);
    const res = await request(app).get("/__perf");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toMatch(/perfstack/);
  });
});

describe("init helper", () => {
  it("wires middleware + dashboard onto app", async () => {
    const app = express();
    const { profiler } = init(app, { dashboardPath: "/__metrics" });
    app.get("/y", (_req, res) => res.json({ ok: true }));
    await request(app).get("/y");
    const dash = await request(app).get("/__metrics.json");
    expect(dash.status).toBe(200);
    expect(dash.body.totalRequests).toBeGreaterThan(0);
    expect(profiler.report().totalRequests).toBeGreaterThan(0);
  });
});
