import { describe, expect, it } from "vitest";
import { applyApiBlocks, block, getPagination, paginationBlock, searchBlock } from "./index.js";
import express from "express";
import request from "supertest";

describe("apiblocks", () => {
  it("pagination attaches state from query", async () => {
    const app = express();
    const r = express.Router();
    applyApiBlocks(r, [paginationBlock({ defaultLimit: 10, maxLimit: 50 })]);
    let seen: unknown;
    r.get("/", (req, res) => {
      seen = getPagination(req);
      res.json(seen);
    });
    app.use(r);
    const res = await request(app).get("/?page=2&limit=5");
    expect(res.body).toMatchObject({ page: 2, limit: 5, skip: 5 });
  });

  it("merges custom block", () => {
    const b = block({
      name: "x",
      middleware: [(_req, _res, next) => next()],
    });
    expect(b.name).toBe("x");
    expect(searchBlock(["title"]).name).toBe("search");
  });
});
