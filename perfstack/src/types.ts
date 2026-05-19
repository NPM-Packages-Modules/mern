export interface Span {
  id: string;
  parentId?: string;
  traceId: string;
  name: string;
  kind: "http" | "db" | "external" | "custom";
  startedAt: number;
  durationMs: number;
  metadata: Record<string, unknown>;
  status: "ok" | "error";
  error?: string;
}

export interface HttpRecord {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  startedAt: number;
  traceId: string;
}

export interface QueryRecord {
  collection: string;
  op: string;
  durationMs: number;
  traceId?: string;
  startedAt: number;
}

export interface MemorySnapshot {
  takenAt: number;
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface HistogramSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface RouteSummary extends HistogramSummary {
  method: string;
  path: string;
  errorCount: number;
}

export interface PerfReport {
  uptimeMs: number;
  startedAt: number;
  takenAt: number;
  totalRequests: number;
  totalErrors: number;
  totalQueries: number;
  http: HistogramSummary;
  routes: RouteSummary[];
  slowestRoutes: RouteSummary[];
  queries: HistogramSummary;
  slowestQueries: QueryRecord[];
  memory: {
    current: MemorySnapshot | null;
    samples: MemorySnapshot[];
    peakRss: number;
    peakHeapUsed: number;
  };
}

export interface PerfstackOptions {
  slowRequestThreshold?: number;
  slowQueryThreshold?: number;
  memorySampleIntervalMs?: number;
  memorySamplesMax?: number;
  routeBucketsMax?: number;
  ignorePaths?: string[];
  enableMemorySampling?: boolean;
  startedAt?: number;
}
