import { describe, expect, it } from "vitest";
import { parseListQuery } from "./index.js";

describe("queryforge", () => {
  it("parses pagination sort and operators", () => {
    const r = parseListQuery(
      {
        page: "2",
        limit: "5",
        sort: "createdAt:desc",
        status: "open",
        amount_gte: "10",
        tags_in: "a,b",
      },
      { allowed: ["status", "amount", "tags", "createdAt"], page: { defaultLimit: 20, maxLimit: 50 } }
    );
    expect(r.skip).toBe(5);
    expect(r.limit).toBe(5);
    expect(r.sort).toEqual({ createdAt: -1 });
    expect(r.filter.status).toBe("open");
    expect(r.filter.amount).toEqual({ $gte: 10 });
    expect(r.filter.tags).toEqual({ $in: ["a", "b"] });
  });
});
