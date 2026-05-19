import { describe, expect, it } from "vitest";
import { Flagmesh, percentEnabled } from "../src/index.js";

describe("flagmesh", () => {
  it("percent is stable per user", () => {
    const a = percentEnabled("x", 50, { userId: "u1" });
    const b = percentEnabled("x", 50, { userId: "u1" });
    expect(a).toBe(b);
  });

  it("boolean and env rules", () => {
    const f = new Flagmesh({ a: true });
    f.setRule("b", { kind: "env", varName: "FLAGMESH_TEST_9f3c", whenMissing: false });
    expect(f.isEnabled("a")).toBe(true);
    process.env.FLAGMESH_TEST_9f3c = "true";
    expect(f.isEnabled("b")).toBe(true);
    delete process.env.FLAGMESH_TEST_9f3c;
  });
});
