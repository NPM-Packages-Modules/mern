import { describe, expect, it } from "vitest";
import { parseDotenv } from "../src/dotenv.js";

describe("dotenv parser", () => {
  it("parses simple key/value pairs", () => {
    expect(parseDotenv("A=1\nB=hello")).toEqual({ A: "1", B: "hello" });
  });

  it("ignores comments and blank lines", () => {
    expect(parseDotenv("# comment\n\nA=1\n# B=2")).toEqual({ A: "1" });
  });

  it("handles quoted values", () => {
    expect(parseDotenv('A="hello world"\nB=\'single\'')).toEqual({
      A: "hello world",
      B: "single",
    });
  });

  it("trims inline comments on unquoted values", () => {
    expect(parseDotenv("A=value # comment")).toEqual({ A: "value" });
  });
});
