import { describe, expect, it } from "vitest";
import { buildListParams } from "./index.js";

describe("buildListParams", () => {
  it("parses pagination and filters", () => {
    const p = buildListParams(
      { page: "2", limit: "10", status: "active", sort: "name:desc" },
      { allowedFilterFields: ["status"], defaultLimit: 20, maxLimit: 50 }
    );
    expect(p.skip).toBe(10);
    expect(p.limit).toBe(10);
    expect(p.filter).toEqual({ status: "active" });
    expect(p.sort).toEqual({ name: -1 });
  });

  it("builds searchOr for q + searchFields", () => {
    const p = buildListParams({ q: "foo" }, { searchFields: ["title", "body"] });
    expect(p.searchOr?.length).toBe(2);
  });
});
