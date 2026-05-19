import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { verifyHmacSha256Header, webhookGuard } from "../src/index.js";

describe("hookmesh", () => {
  it("verifyHmacSha256Header", () => {
    const secret = "k";
    const body = "{}";
    const hex = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyHmacSha256Header(secret, body, `sha256=${hex}`)).toBe(true);
    expect(verifyHmacSha256Header(secret, body, "bad")).toBe(false);
  });

  it("webhookGuard accepts good signature", async () => {
    const app = express();
    app.use(express.json());
    const secret = "s3cr3t";
    app.post("/hook", webhookGuard({ secret }), (_req, res) => res.json({ ok: true }));
    const body = JSON.stringify({ a: 1 });
    const sig = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    const r = await request(app)
      .post("/hook")
      .set("x-hook-signature", `sha256=${sig}`)
      .set("Content-Type", "application/json")
      .send(body);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
