import { describe, expect, it } from "vitest";
import { classifyTransient, withRetry } from "./index.js";

describe("recoverpress", () => {
  it("classifies transient codes", () => {
    expect(classifyTransient({ code: "ETIMEDOUT" })).toBe(true);
    expect(classifyTransient({ code: "EINVAL" })).toBe(false);
  });

  it("withRetry succeeds after transient failure", async () => {
    let calls = 0;
    const v = await withRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw Object.assign(new Error("timeout"), { code: "ECONNRESET" });
        return "ok";
      },
      { maxAttempts: 4, delayMs: 1 }
    );
    expect(v).toBe("ok");
    expect(calls).toBe(2);
  });
});
