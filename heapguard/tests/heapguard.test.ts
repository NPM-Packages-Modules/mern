import { describe, expect, it } from "vitest";
import { heapStatistics, sampleHeap } from "../src/index.js";

describe("heapguard", () => {
  it("sampleHeap returns numeric fields", () => {
    const s = sampleHeap();
    expect(s.heapUsed).toBeGreaterThan(0);
    expect(typeof s.at).toBe("number");
  });

  it("heapStatistics is from v8", () => {
    const h = heapStatistics();
    expect(h.total_heap_size).toBeGreaterThan(0);
  });
});
