import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { routeboost } from "./index.js";

it("headers", async () => {
  const app = express();
  app.get("/", routeboost({ surrogateKey: "api", maxAgeSec: 30 }), (_q, res) => res.send("ok"));
  const h = await request(app).get("/");
  expect(h.headers["x-routeboost"]).toBe("1");
  expect(h.headers["surrogate-key"]).toBe("api");
});
