import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createStacksense, stacksense } from "../src/index.js";

describe("stacksense express middleware", () => {
  it("returns rich error envelope and tracks the error", async () => {
    const handle = createStacksense();

    const app = express();
    app.get("/boom", (_req, _res, next) => next(new Error("kaboom")));
    app.use(handle.middleware);

    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.name).toBe("Error");
    expect(res.body.error.fingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(handle.reporter.size()).toBe(1);
  });

  it("respects custom status mapper", async () => {
    const app = express();
    app.get("/x", (_req, _res, next) => next(new Error("nope")));
    app.use(stacksense({ statusMapper: () => 422 }));
    const res = await request(app).get("/x");
    expect(res.status).toBe(422);
  });

  it("redacts headers and body when exposed", async () => {
    const handle = createStacksense({
      includeRequestBody: true,
      exposeHeaders: true,
    });
    const app = express();
    app.use(express.json());
    app.post("/x", (_req, _res, next) => next(new Error("oh")));
    app.use(handle.middleware);

    await request(app)
      .post("/x")
      .set("authorization", "Bearer abcd")
      .send({ password: "p" });

    const occurrence = handle.list()[0]!;
    expect(occurrence.sample.request?.headers?.authorization).toBe("[REDACTED]");
    expect((occurrence.sample.request?.body as Record<string, unknown>).password).toBe(
      "[REDACTED]",
    );
  });

  it("fires onError hook", async () => {
    const calls: string[] = [];
    const app = express();
    app.get("/x", (_req, _res, next) => next(new Error("hi")));
    app.use(stacksense({ onError: (r) => { calls.push(r.error.message); } }));
    await request(app).get("/x");
    expect(calls).toEqual(["hi"]);
  });

  it("groups identical errors", async () => {
    const handle = createStacksense();
    const app = express();
    app.get("/x", (_req, _res, next) => next(new Error("same")));
    app.use(handle.middleware);
    await request(app).get("/x");
    await request(app).get("/x");
    expect(handle.list()[0]!.count).toBe(2);
  });
});
