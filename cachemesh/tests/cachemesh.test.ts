import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cachemesh } from "../src/index.js";

describe("cachemesh", () => {
  it("caches GET responses", async () => {
    const app = express();
    let n = 0;
    const cm = cachemesh({ ttlMs: 5_000 });
    app.get("/x", cm, (_req, res) => {
      n += 1;
      res.json({ n });
    });
    const a = await request(app).get("/x");
    const b = await request(app).get("/x");
    expect(a.body.n).toBe(1);
    expect(b.body.n).toBe(1);
  });

  it("invalidate busts cache", async () => {
    const app = express();
    const cm = cachemesh({ ttlMs: 5_000 });
    let hits = 0;
    app.get("/y", cm, (_req, res) => {
      hits += 1;
      res.send("ok");
    });
    await request(app).get("/y");
    await request(app).get("/y");
    expect(hits).toBe(1);
    cm.invalidate("GET:/y");
    await request(app).get("/y");
    expect(hits).toBe(2);
  });
});
