import { describe, expect, it } from "vitest";
import { policyflow } from "./index.js";

describe("policyflow", () => {
  it("honors inheritance and wildcards", () => {
    const p = policyflow()
      .inherits("editor", "viewer")
      .allowAction("viewer", "posts.read")
      .allowAction("editor", "posts.update")
      .allowAction("admin", "*");
    expect(p.can("viewer", "posts.read")).toBe(true);
    expect(p.can("viewer", "posts.delete")).toBe(false);
    expect(p.can("editor", "posts.read")).toBe(true);
    expect(p.can("admin", "anything")).toBe(true);
  });
});
