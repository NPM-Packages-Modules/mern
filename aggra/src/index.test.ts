import { describe, expect, it } from "vitest";
import { pipeline } from "./index.js";

describe("aggra", () => {
  it("builds Mongo-style stages", () => {
    const s = pipeline().match({ status: "active" }).sort({ createdAt: -1 }).limit(10).build();
    expect(s[0]).toEqual({ $match: { status: "active" } });
    expect(s[1]).toEqual({ $sort: { createdAt: -1 } });
    expect(s[2]).toEqual({ $limit: 10 });
  });
});
