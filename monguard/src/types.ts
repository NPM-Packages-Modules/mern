export type WarningKind =
  | "slow-query"
  | "missing-index"
  | "n-plus-one"
  | "duplicate-query"
  | "full-collection-scan"
  | "large-result"
  | "aggregation-bottleneck"
  | "overfetching"
  | "missing-projection";

export interface QueryEvent {
  id: string;
  model: string;
  collection: string;
  op: string;
  filter: Record<string, unknown>;
  fields: string[];
  options: Record<string, unknown>;
  pipeline?: Array<Record<string, unknown>>;
  startedAt: number;
  durationMs: number;
  resultCount?: number;
  stack?: string;
}

export interface Warning {
  kind: WarningKind;
  severity: "info" | "warn" | "error";
  message: string;
  suggestion?: string;
  query: QueryEvent;
}

export interface SchemaIndexSpec {
  fields: string[];
  unique?: boolean;
}

export interface MonguardStats {
  totalQueries: number;
  totalDurationMs: number;
  slowQueries: number;
  warnings: Record<WarningKind, number>;
  topSlow: QueryEvent[];
  topDuplicate: Array<{ key: string; count: number; lastSeenAt: number }>;
}

export interface MonguardReporter {
  warn(w: Warning): void;
  observe(q: QueryEvent): void;
}

export interface MonguardOptions {
  slowQueryThreshold?: number;
  duplicateWindowMs?: number;
  duplicateThreshold?: number;
  largeResultThreshold?: number;
  warnOnFullScan?: boolean;
  warnOnMissingProjection?: boolean;
  warnOnMissingIndex?: boolean;
  reporter?: MonguardReporter;
  logger?: (line: string) => void;
  silent?: boolean;
  attachStackTrace?: boolean;
  topSlowSize?: number;
  topDuplicateSize?: number;
}
