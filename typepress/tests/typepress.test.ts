import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  createTypepress,
  t,
  toOpenApi,
  generateTypescriptClient,
  toJsonSchema,
  expressPathToOpenApi,
  schemaToTs,
} from "../src/index.js";

describe("schema primitives", () => {
  it("validates strings with constraints", () => {
    const s = t.string({ min: 2, max: 4 });
    expect(s.parse("ok").success).toBe(true);
    expect(s.parse("a").success).toBe(false);
    expect(s.parse("toolong").success).toBe(false);
  });
  it("coerces numbers from strings", () => {
    const r = t.number({ integer: true, min: 0 }).parse("5");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(5);
  });
  it("validates objects + reports missing keys via path", () => {
    const s = t.object({ email: t.string({ format: "email" }), age: t.number({ min: 0 }) });
    const fail = s.parse({ email: "bad", age: 1 });
    expect(fail.success).toBe(false);
    if (!fail.success) expect(fail.error).toMatch(/email/);
  });
  it("supports optional fields", () => {
    const s = t.object({ name: t.string(), nick: t.optional(t.string()) });
    const ok = s.parse({ name: "x" });
    expect(ok.success).toBe(true);
  });
  it("validates arrays", () => {
    const s = t.array(t.number(), { min: 1 });
    expect(s.parse([]).success).toBe(false);
    expect(s.parse([1, 2]).success).toBe(true);
  });
  it("supports enums + literals + unions", () => {
    expect(t.enums(["a", "b"] as const).parse("a").success).toBe(true);
    expect(t.literal(42).parse(42).success).toBe(true);
    const u = t.union([t.string(), t.number()]);
    expect(u.parse(1).success).toBe(true);
    expect(u.parse("x").success).toBe(true);
    expect(u.parse(true).success).toBe(false);
  });
});

describe("Typepress + Express", () => {
  function makeApp() {
    const api = createTypepress();

    api.get<unknown, { limit: number }>("/users", ({ query }) => {
      return [{ id: "1", name: "Alice" }].slice(0, query.limit);
    }, { query: t.object({ limit: t.number({ integer: true, min: 1 }) }), response: t.array(t.object({ id: t.string(), name: t.string() })) });

    api.get<unknown, unknown, { id: string }, { id: string; name: string }>(
      "/users/:id",
      ({ params }) => ({ id: params.id, name: "Alice" }),
      { params: t.object({ id: t.string({ min: 1 }) }), response: t.object({ id: t.string(), name: t.string() }) },
    );

    api.post<{ name: string; email: string }>(
      "/users",
      ({ body }) => ({ id: "new", ...body }),
      { body: t.object({ name: t.string({ min: 1 }), email: t.string({ format: "email" }) }) },
    );

    api.delete<unknown, unknown, { id: string }>(
      "/users/:id",
      () => undefined,
      { params: t.object({ id: t.string({ min: 1 }) }) },
    );

    const app = express();
    app.use(express.json());
    api.attach(app);
    return { app, api };
  }

  it("runs typed routes happy-path", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/users").query({ limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Alice");
  });

  it("validates body and returns 400 on bad input", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/users").send({ name: "", email: "no" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates params", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/users/abc");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "abc", name: "Alice" });
  });

  it("returns 204 when handler returns undefined", async () => {
    const { app } = makeApp();
    const res = await request(app).delete("/users/abc");
    expect(res.status).toBe(204);
  });

  it("validates response and 500s on mismatch", async () => {
    const api = createTypepress();
    api.get("/x", () => ({ wrong: true }), { response: t.object({ id: t.string() }) });
    const app = express();
    app.use(express.json());
    api.attach(app);
    const res = await request(app).get("/x");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("RESPONSE_VALIDATION");
  });
});

describe("OpenAPI generator", () => {
  it("converts paths and schemas", () => {
    const api = createTypepress();
    api.get<unknown, { q: string }>(
      "/search",
      ({ query }) => [query.q],
      {
        query: t.object({ q: t.string({ min: 1 }) }),
        response: t.array(t.string()),
      },
    );
    const spec = toOpenApi(api, { title: "Test", version: "1.0.0" });
    expect(spec.openapi).toBe("3.1.0");
    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/search"]).toBeDefined();
  });

  it("expressPathToOpenApi maps :id to {id}", () => {
    expect(expressPathToOpenApi("/users/:id/posts/:postId")).toBe("/users/{id}/posts/{postId}");
  });

  it("toJsonSchema handles nested objects", () => {
    const s = toJsonSchema(t.object({ a: t.number(), b: t.optional(t.string()) }).describe());
    expect((s as { type: string }).type).toBe("object");
  });
});

describe("Client generator", () => {
  it("produces TypeScript with class + methods", () => {
    const api = createTypepress();
    api.post<{ x: string }>("/things", ({ body }) => body, { body: t.object({ x: t.string() }) });
    const code = generateTypescriptClient(api, { className: "MyClient" });
    expect(code).toMatch(/class MyClient/);
    expect(code).toMatch(/async postThings/);
    expect(code).toMatch(/Promise<unknown>/);
  });

  it("schemaToTs supports unions and arrays", () => {
    const s = t.object({ tags: t.array(t.enums(["a", "b"] as const)) }).describe();
    expect(schemaToTs(s)).toMatch(/Array<"a" \| "b">/);
  });
});
