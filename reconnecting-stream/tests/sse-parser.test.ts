import { describe, expect, it } from "vitest";
import { SSEParser, BoundedQueue, nextDelay, DEFAULT_BACKOFF } from "../src/index.js";

describe("SSEParser", () => {
  it("dispatches simple events", () => {
    const p = new SSEParser();
    const events = p.feed("data: hello\n\n");
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe("hello");
    expect(events[0]!.event).toBe(null);
  });

  it("supports multi-line data", () => {
    const p = new SSEParser();
    const events = p.feed("data: line1\ndata: line2\n\n");
    expect(events[0]!.data).toBe("line1\nline2");
  });

  it("captures id and event fields", () => {
    const p = new SSEParser();
    const events = p.feed("id: 42\nevent: message\ndata: hi\n\n");
    expect(events[0]!.id).toBe("42");
    expect(events[0]!.event).toBe("message");
    expect(p.getLastEventId()).toBe("42");
  });

  it("ignores comment lines", () => {
    const p = new SSEParser();
    const events = p.feed(": ping\ndata: x\n\n");
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe("x");
  });

  it("invokes onRetry for retry fields", () => {
    let r: number | null = null;
    const p = new SSEParser({ onRetry: (ms) => (r = ms) });
    p.feed("retry: 5000\n\n");
    expect(r).toBe(5000);
  });

  it("handles chunked input across boundaries", () => {
    const p = new SSEParser();
    expect(p.feed("data: he").length).toBe(0);
    expect(p.feed("llo\n").length).toBe(0);
    expect(p.feed("\n").length).toBe(1);
  });
});

describe("BoundedQueue", () => {
  it("drops oldest by default", () => {
    const q = new BoundedQueue<number>({ maxSize: 2 });
    q.push(1); q.push(2); q.push(3);
    expect(q.drain()).toEqual([2, 3]);
  });
  it("drops newest when configured", () => {
    const q = new BoundedQueue<number>({ maxSize: 2, onOverflow: "drop-newest" });
    q.push(1); q.push(2); q.push(3);
    expect(q.drain()).toEqual([1, 2]);
  });
  it("throws on overflow when configured", () => {
    const q = new BoundedQueue<number>({ maxSize: 1, onOverflow: "throw" });
    q.push(1);
    expect(() => q.push(2)).toThrow();
  });
});

describe("backoff", () => {
  it("respects the max cap", () => {
    const d = nextDelay({ initial: 100, max: 1000, multiplier: 2, jitter: 0 }, 20);
    expect(d).toBeLessThanOrEqual(1000);
  });
  it("full jitter gives a distribution within [0, cap]", () => {
    const samples = Array.from({ length: 1000 }, () => nextDelay({ initial: 100, max: 1000, jitter: 1, multiplier: 2 }, 5));
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1000);
    }
  });
  it("DEFAULT_BACKOFF has known shape", () => {
    expect(DEFAULT_BACKOFF.initial).toBe(1000);
    expect(DEFAULT_BACKOFF.max).toBe(30_000);
  });
});
