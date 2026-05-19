import { describe, expect, it } from "vitest";
import {
  parseError,
  parseStack,
  fingerprintError,
  deriveHints,
  InMemoryReporter,
  reportToGithubIssue,
  rootCauseSummary,
  formatReport,
  buildRedactor,
} from "../src/index.js";

describe("parseStack", () => {
  it("parses v8 stack lines", () => {
    const stack =
      "Error: boom\n" +
      "    at fn (/Users/me/proj/src/file.ts:10:5)\n" +
      "    at <anonymous> (node_modules/foo/index.js:3:1)\n" +
      "    at internal (node:internal/process/task_queues:96:5)";
    const frames = parseStack(stack, ["/Users/me/proj"]);
    expect(frames).toHaveLength(3);
    expect(frames[0]!.function).toBe("fn");
    expect(frames[0]!.line).toBe(10);
    expect(frames[0]!.inApp).toBe(true);
    expect(frames[1]!.inApp).toBe(false);
    expect(frames[2]!.isNative).toBe(true);
  });

  it("returns [] for missing stack", () => {
    expect(parseStack(undefined)).toEqual([]);
  });
});

describe("parseError", () => {
  it("parses Error instances", () => {
    function inner() { throw new Error("nope"); }
    let parsed;
    try { inner(); } catch (e) { parsed = parseError(e); }
    expect(parsed!.name).toBe("Error");
    expect(parsed!.message).toBe("nope");
    expect(parsed!.frames.length).toBeGreaterThan(0);
  });

  it("handles non-error throws", () => {
    expect(parseError("oops")).toMatchObject({ name: "Thrown", message: "oops" });
    expect(parseError(42)).toMatchObject({ name: "Thrown", message: "42" });
    expect(parseError({ message: "x" }).message).toBe("x");
  });

  it("handles error causes", () => {
    const root = new Error("root cause");
    const wrapper = new Error("wrapped", { cause: root });
    const parsed = parseError(wrapper);
    expect(parsed.cause?.message).toBe("root cause");
  });
});

describe("fingerprintError", () => {
  it("produces the same fingerprint for the same error", () => {
    const a = new Error("user xyz123 not found");
    const b = new Error("user abc789 not found");
    expect(fingerprintError(parseError(a))).toBe(fingerprintError(parseError(b)));
  });
  it("differs when error type differs", () => {
    expect(fingerprintError(parseError(new Error("x"))))
      .not.toBe(fingerprintError(parseError(new TypeError("x"))));
  });
});

describe("deriveHints", () => {
  it("recognizes ECONNREFUSED", () => {
    const r = deriveHints(parseError(new Error("connect ECONNREFUSED 127.0.0.1:6379")));
    expect(r.hints.join(" ")).toMatch(/connection was refused/i);
    expect(r.suggestedFix).toBeDefined();
  });
  it("recognizes JWT errors", () => {
    const r = deriveHints(parseError(new Error("jwt expired")));
    expect(r.hints.join(" ")).toMatch(/JWT/);
  });
  it("recognizes Mongo duplicate key", () => {
    const r = deriveHints(parseError(new Error("E11000 duplicate key error")));
    expect(r.hints.join(" ")).toMatch(/unique constraint/);
  });
  it("returns empty when no rule matches", () => {
    expect(deriveHints(parseError(new Error("¯\\_(ツ)_/¯"))).hints).toEqual([]);
  });
});

describe("InMemoryReporter", () => {
  it("counts repeated errors by fingerprint", () => {
    const r = new InMemoryReporter();
    const make = () => ({
      fingerprint: "abc",
      occurredAt: new Date().toISOString(),
      level: "error" as const,
      error: parseError(new Error("x")),
      hints: [],
    });
    r.record(make());
    r.record(make());
    r.record(make());
    expect(r.size()).toBe(1);
    expect(r.list()[0]!.count).toBe(3);
  });
  it("evicts when exceeding capacity", () => {
    const r = new InMemoryReporter({ maxEntries: 2 });
    for (let i = 0; i < 3; i++) {
      r.record({
        fingerprint: `f${i}`,
        occurredAt: new Date().toISOString(),
        level: "error",
        error: parseError(new Error(`e${i}`)),
        hints: [],
      });
    }
    expect(r.size()).toBe(2);
  });
});

describe("formatters", () => {
  const report = {
    fingerprint: "abc123",
    occurredAt: new Date(0).toISOString(),
    level: "error" as const,
    error: parseError(new Error("boom")),
    request: { method: "GET", path: "/x" },
    hints: ["something"],
    suggestedFix: "fix it",
  };
  it("formatReport returns a printable string", () => {
    const out = formatReport(report, { color: false });
    expect(out).toMatch(/Error: boom/);
    expect(out).toMatch(/fingerprint=abc123/);
  });
  it("reportToGithubIssue produces title + body", () => {
    const r = reportToGithubIssue(report);
    expect(r.title).toMatch(/Error/);
    expect(r.body).toMatch(/Fingerprint/);
  });
  it("rootCauseSummary follows cause chain", () => {
    const e = parseError(new Error("outer", { cause: new Error("inner") }));
    expect(rootCauseSummary(e)).toMatch(/outer.*<-.*inner/);
  });
});

describe("buildRedactor", () => {
  it("masks default sensitive keys", () => {
    const out = buildRedactor()({ token: "x", normal: 1 }) as Record<string, unknown>;
    expect(out.token).toBe("[REDACTED]");
    expect(out.normal).toBe(1);
  });
});
