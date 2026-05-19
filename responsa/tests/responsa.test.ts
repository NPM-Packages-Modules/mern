import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  responsa,
  errorHandler,
  ApiError,
  badRequest,
  notFound,
  buildSuccess,
  buildPaginated,
  buildError,
} from "../src/index.js";

function makeApp(opts: Parameters<typeof responsa>[0] = {}) {
  const app = express();
  app.use(express.json());
  app.use(responsa(opts));

  app.get("/ok", (_req, res) => {
    res.success({ id: 1 });
  });
  app.post("/create", (_req, res) => {
    res.created({ id: 99 });
  });
  app.get("/empty", (_req, res) => {
    res.noContent();
  });
  app.get("/list", (_req, res) => {
    res.paginated([1, 2, 3], { page: 2, pageSize: 3, total: 10 });
  });
  app.get("/err", (_req, res) => {
    res.error("Boom", { status: 400, code: "BAD" });
  });
  app.get("/throw", (_req, _res, next) => {
    next(badRequest("invalid id", { field: "id" }));
  });
  app.get("/notfound", (_req, _res, next) => {
    next(notFound());
  });
  app.get("/native", (_req, _res, next) => {
    next(new Error("kaboom"));
  });
  app.get("/api", (_req, _res, next) => {
    next(new ApiError("Custom", { status: 418, code: "TEAPOT" }));
  });

  app.use(errorHandler(opts));
  return app;
}

describe("responsa middleware", () => {
  it("wraps success responses", async () => {
    const res = await request(makeApp()).get("/ok");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ id: 1 });
    expect(res.body.meta.traceId).toMatch(/^tr_/);
    expect(res.body.meta.timestamp).toBeTruthy();
    expect(typeof res.body.meta.durationMs).toBe("number");
  });

  it("sends 201 for created()", async () => {
    const res = await request(makeApp()).post("/create");
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(99);
  });

  it("sends 204 for noContent()", async () => {
    const res = await request(makeApp()).get("/empty");
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("emits pagination metadata", async () => {
    const res = await request(makeApp()).get("/list");
    expect(res.body.data).toEqual([1, 2, 3]);
    expect(res.body.pagination).toEqual({
      page: 2,
      pageSize: 3,
      total: 10,
      totalPages: 4,
      hasNext: true,
      hasPrev: true,
    });
  });

  it("formats explicit errors", async () => {
    const res = await request(makeApp()).get("/err");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "BAD", message: "Boom", status: 400 },
    });
  });

  it("error handler converts ApiError instances", async () => {
    const res = await request(makeApp()).get("/throw");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.details).toEqual({ field: "id" });
  });

  it("error handler returns 404 helpers", async () => {
    const res = await request(makeApp()).get("/notfound");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("masks native 500 errors", async () => {
    const res = await request(makeApp()).get("/native");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("respects custom ApiError status", async () => {
    const res = await request(makeApp()).get("/api");
    expect(res.status).toBe(418);
    expect(res.body.error.code).toBe("TEAPOT");
  });

  it("echoes incoming trace id header", async () => {
    const res = await request(makeApp()).get("/ok").set("x-trace-id", "client-123");
    expect(res.body.meta.traceId).toBe("client-123");
    expect(res.headers["x-trace-id"]).toBe("client-123");
  });
});

describe("envelope builders (pure)", () => {
  const meta = { traceId: "t1", startedAt: Date.now() };
  it("buildSuccess produces correct shape", () => {
    const env = buildSuccess({ a: 1 }, meta);
    expect(env.success).toBe(true);
    expect(env.data).toEqual({ a: 1 });
    expect(env.meta.traceId).toBe("t1");
  });
  it("buildPaginated computes totalPages", () => {
    const env = buildPaginated([1, 2], { page: 1, pageSize: 2, total: 5 }, meta);
    expect(env.pagination.totalPages).toBe(3);
    expect(env.pagination.hasNext).toBe(true);
    expect(env.pagination.hasPrev).toBe(false);
  });
  it("buildError preserves code/status", () => {
    const env = buildError("bad", { ...meta, status: 400, code: "BAD" });
    expect(env.success).toBe(false);
    expect(env.error.code).toBe("BAD");
    expect(env.error.status).toBe(400);
  });
});
