import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { versionpress } from "../src/index.js";

describe("versionpress", () => {
  it("sets apiVersion from header", async () => {
    const app = express();
    app.use(versionpress());
    app.get("/x", (req, res) => res.json({ v: req.apiVersion }));
    const r = await request(app).get("/x").set("x-api-version", "2");
    expect(r.body.v).toBe("2");
  });

  it("default version", async () => {
    const app = express();
    app.use(versionpress());
    app.get("/x", (req, res) => res.json({ v: req.apiVersion }));
    const r = await request(app).get("/x");
    expect(r.body.v).toBe("1");
  });
});
