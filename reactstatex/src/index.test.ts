import { describe, it, expect } from "vitest";
import { reactstatex } from "./index.js";

describe("reactstatex", () => {
  it("exports scaffold API", () => {
    expect(reactstatex()).toEqual({ ok: true, package: "reactstatex" });
  });
});
