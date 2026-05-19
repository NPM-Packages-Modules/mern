import { Histogram } from "./histogram.js";
import { Tracer } from "./tracer.js";
import type {
  HttpRecord,
  MemorySnapshot,
  PerfReport,
  PerfstackOptions,
  QueryRecord,
  RouteSummary,
} from "./types.js";

interface RouteBucket {
  method: string;
  path: string;
  histogram: Histogram;
  errors: number;
}

export class Profiler {
  private startedAt: number;
  private httpHistogram = new Histogram();
  private queryHistogram = new Histogram();
  private routes = new Map<string, RouteBucket>();
  private slowestQueries: QueryRecord[] = [];
  private memorySamples: MemorySnapshot[] = [];
  private peakRss = 0;
  private peakHeapUsed = 0;
  private totalRequests = 0;
  private totalErrors = 0;
  private totalQueries = 0;
  private memoryInterval?: NodeJS.Timeout;
  readonly tracer: Tracer;
  private opts: Required<Pick<
    PerfstackOptions,
    | "slowRequestThreshold"
    | "slowQueryThreshold"
    | "memorySampleIntervalMs"
    | "memorySamplesMax"
    | "routeBucketsMax"
    | "enableMemorySampling"
  >>;

  constructor(options: PerfstackOptions = {}) {
    this.startedAt = options.startedAt ?? Date.now();
    this.opts = {
      slowRequestThreshold: options.slowRequestThreshold ?? 500,
      slowQueryThreshold: options.slowQueryThreshold ?? 200,
      memorySampleIntervalMs: options.memorySampleIntervalMs ?? 5_000,
      memorySamplesMax: options.memorySamplesMax ?? 120,
      routeBucketsMax: options.routeBucketsMax ?? 200,
      enableMemorySampling: options.enableMemorySampling ?? false,
    };
    this.tracer = new Tracer();
    if (this.opts.enableMemorySampling) this.startMemorySampling();
  }

  recordHttp(record: HttpRecord): void {
    this.totalRequests += 1;
    if (record.statusCode >= 500) this.totalErrors += 1;
    this.httpHistogram.record(record.durationMs);
    const key = `${record.method} ${record.path}`;
    let bucket = this.routes.get(key);
    if (!bucket) {
      if (this.routes.size >= this.opts.routeBucketsMax) {
        const oldest = this.routes.keys().next().value;
        if (oldest !== undefined) this.routes.delete(oldest);
      }
      bucket = { method: record.method, path: record.path, histogram: new Histogram(), errors: 0 };
      this.routes.set(key, bucket);
    }
    bucket.histogram.record(record.durationMs);
    if (record.statusCode >= 500) bucket.errors += 1;
  }

  recordQuery(record: QueryRecord): void {
    this.totalQueries += 1;
    this.queryHistogram.record(record.durationMs);
    if (record.durationMs >= this.opts.slowQueryThreshold) {
      this.slowestQueries.push(record);
      this.slowestQueries.sort((a, b) => b.durationMs - a.durationMs);
      if (this.slowestQueries.length > 50) this.slowestQueries.length = 50;
    }
  }

  takeMemorySample(): MemorySnapshot {
    const m = process.memoryUsage();
    const snap: MemorySnapshot = {
      takenAt: Date.now(),
      rss: m.rss,
      heapTotal: m.heapTotal,
      heapUsed: m.heapUsed,
      external: m.external,
      arrayBuffers: m.arrayBuffers,
    };
    this.memorySamples.push(snap);
    if (this.memorySamples.length > this.opts.memorySamplesMax) this.memorySamples.shift();
    if (snap.rss > this.peakRss) this.peakRss = snap.rss;
    if (snap.heapUsed > this.peakHeapUsed) this.peakHeapUsed = snap.heapUsed;
    return snap;
  }

  startMemorySampling(): void {
    if (this.memoryInterval) return;
    this.takeMemorySample();
    this.memoryInterval = setInterval(() => this.takeMemorySample(), this.opts.memorySampleIntervalMs);
    if (typeof this.memoryInterval.unref === "function") this.memoryInterval.unref();
  }

  stopMemorySampling(): void {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = undefined;
    }
  }

  report(): PerfReport {
    if (this.memorySamples.length === 0) this.takeMemorySample();
    const routes: RouteSummary[] = Array.from(this.routes.values()).map((bucket) => ({
      method: bucket.method,
      path: bucket.path,
      errorCount: bucket.errors,
      ...bucket.histogram.summary(),
    }));
    const slowestRoutes = [...routes].sort((a, b) => b.p95 - a.p95).slice(0, 10);
    return {
      uptimeMs: Date.now() - this.startedAt,
      startedAt: this.startedAt,
      takenAt: Date.now(),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      totalQueries: this.totalQueries,
      http: this.httpHistogram.summary(),
      routes,
      slowestRoutes,
      queries: this.queryHistogram.summary(),
      slowestQueries: [...this.slowestQueries],
      memory: {
        current: this.memorySamples.at(-1) ?? null,
        samples: [...this.memorySamples],
        peakRss: this.peakRss,
        peakHeapUsed: this.peakHeapUsed,
      },
    };
  }

  reset(): void {
    this.httpHistogram.reset();
    this.queryHistogram.reset();
    this.routes.clear();
    this.slowestQueries = [];
    this.memorySamples = [];
    this.peakRss = 0;
    this.peakHeapUsed = 0;
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.totalQueries = 0;
    this.tracer.reset();
  }

  isSlowRequest(durationMs: number): boolean {
    return durationMs >= this.opts.slowRequestThreshold;
  }
}
