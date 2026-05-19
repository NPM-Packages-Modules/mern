import { describe, it, expect } from "vitest";
import { modelsync } from "./index.js";

describe("modelsync", () => {
  it("exports scaffold API", () => {
    expect(modelsync()).toEqual({ ok: true, package: "modelsync" });
  });
});
