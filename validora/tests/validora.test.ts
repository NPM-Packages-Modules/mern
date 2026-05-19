import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { validateBody, z } from "../src/index.js";

describe("validora", () => {
  it("rejects bad body", async () => {
    const app = express();
    app.use(express.json());
    app.post("/x", validateBody(z.object({ a: z.number() })), (_q, res) => res.json({ ok: 1 }));
    const r = await request(app).post("/x").send({ a: "nope" });
    expect(r.status).toBe(400);
  });

  it("accepts good body", async () => {
    const app = express();
    app.use(express.json());
    app.post("/x", validateBody(z.object({ a: z.number() })), (_q, res) => res.json({ ok: 1 }));
    const r = await request(app).post("/x").send({ a: 1 });
    expect(r.status).toBe(200);
  });
});
