import express from "express";
import { describe, expect, it } from "vitest";
import { generateVitestStub, listExpressRoutes } from "../src/index.js";

describe("routecheck", () => {
  it("lists shallow routes", () => {
    const app = express();
    app.get("/a", (_q, res) => res.send("a"));
    app.post("/b", (_q, res) => res.send("b"));
    const r = listExpressRoutes(app);
    expect(r).toEqual(
      expect.arrayContaining([
        { method: "GET", path: "/a" },
        { method: "POST", path: "/b" },
      ]),
    );
  });

  it("generateVitestStub", () => {
    const s = generateVitestStub([{ method: "GET", path: "/x" }]);
    expect(s).toContain("GET /x");
  });
});
