import { describe, expect, it, vi } from "vitest";
import { JobForge } from "../src/index.js";

describe("jobforge", () => {
  it("runs delayed job", async () => {
    const jf = new JobForge();
    const fn = vi.fn();
    jf.schedule("a", fn, { delayMs: 10 });
    await new Promise((r) => setTimeout(r, 40));
    expect(fn).toHaveBeenCalled();
    jf.cancel("a");
  });

  it("retries then succeeds", async () => {
    const jf = new JobForge();
    let n = 0;
    const fn = vi.fn(async () => {
      n += 1;
      if (n < 2) throw new Error("fail");
    });
    jf.schedule("r", fn, { retries: 4, maxBackoffMs: 5 });
    await new Promise((r) => setTimeout(r, 80));
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
    jf.cancel("r");
  });

  it("exposes monitoring", async () => {
    const jf = new JobForge();
    jf.schedule("m", () => {}, { everyMs: 1000 });
    expect(jf.monitoring()[0]?.id).toBe("m");
    jf.cancel("m");
  });
});
