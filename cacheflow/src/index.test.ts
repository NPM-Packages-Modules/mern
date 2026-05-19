import { describe, expect, it } from "vitest";
import { cacheflow } from "./index.js";

describe("cacheflow", () => {
  it("invalidates tags by dependency keys", () => {
    const c = cacheflow();
    c.track("feed:u1", ["User:u1", "Post:p1"]);
    c.track("post:p1", ["Post:p1"]);
    const tags = c.invalidateDeps("Post:p1");
    expect(tags.has("feed:u1")).toBe(true);
    expect(tags.has("post:p1")).toBe(true);
    c.track("feed:u1", ["User:u1"]);
    expect(c.invalidateDeps("User:u1").has("feed:u1")).toBe(true);
  });
});
