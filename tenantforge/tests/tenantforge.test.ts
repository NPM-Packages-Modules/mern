import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { tenantforge, tenantScope } from "../src/index.js";

describe("tenantforge", () => {
  it("requires header", async () => {
    const app = express();
    app.get("/a", tenantforge(), (req, res) => res.json({ t: (req as express.Request & { tenantId: string }).tenantId }));
    const r = await request(app).get("/a");
    expect(r.status).toBe(400);
    const ok = await request(app).get("/a").set("x-tenant-id", "org_1");
    expect(ok.status).toBe(200);
    expect(ok.body.t).toBe("org_1");
  });

  it("allowList", async () => {
    const app = express();
    app.use(tenantforge({ allowList: new Set(["a"]) }));
    app.get("/x", (_q, res) => res.send("ok"));
    expect((await request(app).get("/x").set("x-tenant-id", "b")).status).toBe(403);
  });

  it("tenantScope", () => {
    expect(tenantScope("x")).toEqual({ tenantId: "x" });
  });
});
