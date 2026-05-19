import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { __resetRatemeshForTests, ratemesh } from "../src/index.js";

afterEach(() => __resetRatemeshForTests());

describe("ratemesh", () => {
  it("429 after max", async () => {
    const app = express();
    app.get("/x", ratemesh({ windowMs: 10_000, max: 2 }), (_req, res) => res.send("ok"));
    expect((await request(app).get("/x")).status).toBe(200);
    expect((await request(app).get("/x")).status).toBe(200);
    expect((await request(app).get("/x")).status).toBe(429);
  });
});
