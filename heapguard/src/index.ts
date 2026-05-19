import { clearInterval, setInterval } from "node:timers";
import v8 from "node:v8";

export type HeapSample = {
  at: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
};

export function sampleHeap(): HeapSample {
  const m = process.memoryUsage();
  return {
    at: Date.now(),
    heapUsed: m.heapUsed,
    heapTotal: m.heapTotal,
    rss: m.rss,
    external: m.external,
    arrayBuffers: m.arrayBuffers,
  };
}

/** v8 heap limit and space breakdown — useful in dashboards. */
export function heapStatistics() {
  return v8.getHeapStatistics();
}

export interface MonitorOptions {
  intervalMs?: number;
  /** Alert when heapUsed grows by this factor vs previous tick */
  growthFactor?: number;
  onLeakSuspect?: (prev: HeapSample, cur: HeapSample, factor: number) => void;
}

/**
 * Periodically samples `process.memoryUsage` and invokes `onLeakSuspect`
 * when heapUsed jumps by `growthFactor` (default 1.45) between ticks.
 */
export function monitor(opts: MonitorOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? 15_000;
  const growthFactor = opts.growthFactor ?? 1.45;
  let prev = sampleHeap();

  const id = setInterval(() => {
    const cur = sampleHeap();
    if (prev.heapUsed > 0 && cur.heapUsed / prev.heapUsed >= growthFactor) {
      opts.onLeakSuspect?.(prev, cur, cur.heapUsed / prev.heapUsed);
    }
    prev = cur;
  }, intervalMs);

  return () => clearInterval(id);
}
