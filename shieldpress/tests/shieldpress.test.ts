import { describe, expect, it } from "vitest";
import { mergeFindings, scanSource } from "../src/index.js";

describe("shieldpress", () => {
  it("flags eval", () => {
    const f = scanSource("x.ts", "eval('1')\napp.get('/',()=>{})");
    expect(f.some((x) => x.rule === "eval")).toBe(true);
  });

  it("mergeFindings", () => {
    expect(mergeFindings([{ rule: "a", severity: "error", message: "m", file: "f" }])).toEqual({ errors: 1, warns: 0 });
  });
});
