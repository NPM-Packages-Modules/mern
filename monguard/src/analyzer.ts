import {
  indexCoversFields,
  isFullScan,
  suggestCompoundIndex,
  unindexedFields,
} from "./index-analysis.js";
import { extractFilterFields, fingerprintQuery } from "./keys.js";
import type {
  MonguardOptions,
  MonguardReporter,
  MonguardStats,
  QueryEvent,
  SchemaIndexSpec,
  Warning,
  WarningKind,
} from "./types.js";

interface DuplicateBucket {
  key: string;
  timestamps: number[];
  count: number;
  lastSeenAt: number;
}

const DEFAULTS = {
  slowQueryThreshold: 200,
  duplicateWindowMs: 1000,
  duplicateThreshold: 5,
  largeResultThreshold: 1000,
  warnOnFullScan: true,
  warnOnMissingProjection: false,
  warnOnMissingIndex: true,
  topSlowSize: 25,
  topDuplicateSize: 25,
} as const;

export class Analyzer {
  private opts: Required<Pick<MonguardOptions, keyof typeof DEFAULTS>>;
  private indexes = new Map<string, SchemaIndexSpec[]>();
  private duplicates = new Map<string, DuplicateBucket>();
  private warningCounts: Record<WarningKind, number> = {
    "slow-query": 0,
    "missing-index": 0,
    "n-plus-one": 0,
    "duplicate-query": 0,
    "full-collection-scan": 0,
    "large-result": 0,
    "aggregation-bottleneck": 0,
    "overfetching": 0,
    "missing-projection": 0,
  };
  private totalQueries = 0;
  private totalDurationMs = 0;
  private slowQueries = 0;
  private topSlow: QueryEvent[] = [];
  private reporter?: MonguardReporter;

  constructor(options: MonguardOptions = {}) {
    this.opts = {
      slowQueryThreshold: options.slowQueryThreshold ?? DEFAULTS.slowQueryThreshold,
      duplicateWindowMs: options.duplicateWindowMs ?? DEFAULTS.duplicateWindowMs,
      duplicateThreshold: options.duplicateThreshold ?? DEFAULTS.duplicateThreshold,
      largeResultThreshold: options.largeResultThreshold ?? DEFAULTS.largeResultThreshold,
      warnOnFullScan: options.warnOnFullScan ?? DEFAULTS.warnOnFullScan,
      warnOnMissingProjection:
        options.warnOnMissingProjection ?? DEFAULTS.warnOnMissingProjection,
      warnOnMissingIndex: options.warnOnMissingIndex ?? DEFAULTS.warnOnMissingIndex,
      topSlowSize: options.topSlowSize ?? DEFAULTS.topSlowSize,
      topDuplicateSize: options.topDuplicateSize ?? DEFAULTS.topDuplicateSize,
    };
    this.reporter = options.reporter;
  }

  registerIndexes(collection: string, indexes: SchemaIndexSpec[]): void {
    this.indexes.set(collection, indexes);
  }

  getIndexes(collection: string): SchemaIndexSpec[] {
    return this.indexes.get(collection) ?? [];
  }

  observe(event: QueryEvent): Warning[] {
    this.totalQueries += 1;
    this.totalDurationMs += event.durationMs;
    if (event.durationMs >= this.opts.slowQueryThreshold) this.slowQueries += 1;
    this.recordTopSlow(event);
    this.reporter?.observe(event);

    const warnings: Warning[] = [];
    const indexes = this.getIndexes(event.collection);

    if (event.durationMs >= this.opts.slowQueryThreshold) {
      warnings.push({
        kind: "slow-query",
        severity: "warn",
        message: `Slow ${event.op} on ${event.collection} (${event.durationMs}ms)`,
        suggestion:
          event.filter && Object.keys(event.filter).length > 0
            ? `Consider an index on { ${extractFilterFields(event.filter).join(", ")} }.`
            : "Avoid scanning the full collection; add a filter.",
        query: event,
      });
    }

    if (event.pipeline && event.pipeline.length > 0) {
      const pipelineWarnings = analyzePipeline(event);
      warnings.push(...pipelineWarnings);
    } else {
      const filterFields = extractFilterFields(event.filter);
      if (this.opts.warnOnFullScan && isFullScan(event.filter) && isReadOp(event.op)) {
        warnings.push({
          kind: "full-collection-scan",
          severity: "warn",
          message: `Full collection scan on ${event.collection} via ${event.op}.`,
          suggestion: "Provide a filter or limit to avoid scanning every document.",
          query: event,
        });
      }
      if (
        this.opts.warnOnMissingIndex &&
        filterFields.length > 0 &&
        indexes.length > 0 &&
        !indexCoversFields(filterFields, indexes)
      ) {
        const missing = unindexedFields(filterFields, indexes);
        const suggested = suggestCompoundIndex(filterFields);
        warnings.push({
          kind: "missing-index",
          severity: "warn",
          message: `Missing index on ${event.collection} for fields [${missing.join(", ")}].`,
          suggestion: `Add an index: { ${suggested.fields.map((f) => `${f}: 1`).join(", ")} }`,
          query: event,
        });
      }
      if (
        this.opts.warnOnMissingProjection &&
        isReadOp(event.op) &&
        event.fields.length === 0 &&
        !event.options?.projection
      ) {
        warnings.push({
          kind: "missing-projection",
          severity: "info",
          message: `No projection specified for ${event.op} on ${event.collection}.`,
          suggestion: "Return only the fields you need with .select() or projection.",
          query: event,
        });
      }
    }

    if (event.resultCount !== undefined && event.resultCount >= this.opts.largeResultThreshold) {
      warnings.push({
        kind: "large-result",
        severity: "warn",
        message: `Large result set: ${event.resultCount} documents from ${event.collection}.`,
        suggestion: "Paginate, stream, or aggregate server-side.",
        query: event,
      });
    }

    const dupKey = fingerprintQuery(event.op, event.collection, event.filter);
    const duplicateWarning = this.observeDuplicate(dupKey, event);
    if (duplicateWarning) warnings.push(duplicateWarning);

    for (const w of warnings) {
      this.warningCounts[w.kind] += 1;
      this.reporter?.warn(w);
    }

    return warnings;
  }

  private observeDuplicate(key: string, event: QueryEvent): Warning | undefined {
    const now = event.startedAt;
    const bucket = this.duplicates.get(key) ?? {
      key,
      timestamps: [],
      count: 0,
      lastSeenAt: now,
    };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t <= this.opts.duplicateWindowMs);
    bucket.timestamps.push(now);
    bucket.count = bucket.timestamps.length;
    bucket.lastSeenAt = now;
    this.duplicates.set(key, bucket);

    if (bucket.count >= this.opts.duplicateThreshold) {
      return {
        kind: bucket.count >= this.opts.duplicateThreshold * 2 ? "n-plus-one" : "duplicate-query",
        severity: bucket.count >= this.opts.duplicateThreshold * 2 ? "error" : "warn",
        message:
          bucket.count >= this.opts.duplicateThreshold * 2
            ? `Potential N+1 on ${event.collection}: ${bucket.count} duplicate ${event.op}s in ${this.opts.duplicateWindowMs}ms.`
            : `${bucket.count} duplicate ${event.op}s on ${event.collection} in ${this.opts.duplicateWindowMs}ms.`,
        suggestion: "Batch with $in/lookup, or memoize by key in this request.",
        query: event,
      };
    }
    return undefined;
  }

  stats(): MonguardStats {
    return {
      totalQueries: this.totalQueries,
      totalDurationMs: this.totalDurationMs,
      slowQueries: this.slowQueries,
      warnings: { ...this.warningCounts },
      topSlow: [...this.topSlow],
      topDuplicate: Array.from(this.duplicates.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, this.opts.topDuplicateSize)
        .map((b) => ({ key: b.key, count: b.count, lastSeenAt: b.lastSeenAt })),
    };
  }

  reset(): void {
    this.duplicates.clear();
    this.totalQueries = 0;
    this.totalDurationMs = 0;
    this.slowQueries = 0;
    this.topSlow = [];
    for (const k of Object.keys(this.warningCounts) as WarningKind[]) {
      this.warningCounts[k] = 0;
    }
  }

  private recordTopSlow(event: QueryEvent): void {
    this.topSlow.push(event);
    this.topSlow.sort((a, b) => b.durationMs - a.durationMs);
    if (this.topSlow.length > this.opts.topSlowSize) {
      this.topSlow.length = this.opts.topSlowSize;
    }
  }
}

function isReadOp(op: string): boolean {
  return /^(find|findOne|findById|count|countDocuments|estimatedDocumentCount|distinct|aggregate)/i.test(
    op,
  );
}

function analyzePipeline(event: QueryEvent): Warning[] {
  const warnings: Warning[] = [];
  const pipeline = event.pipeline ?? [];
  if (pipeline.length === 0) return warnings;

  let sawMatch = false;
  let sawSort = false;
  for (const stage of pipeline) {
    const key = Object.keys(stage)[0];
    if (key === "$match") sawMatch = true;
    if (key === "$sort" && !sawMatch) {
      warnings.push({
        kind: "aggregation-bottleneck",
        severity: "warn",
        message: `Aggregation on ${event.collection} sorts before filtering ($sort before $match).`,
        suggestion: "Move $match before $sort/$lookup to reduce documents processed.",
        query: event,
      });
    }
    if (key === "$sort") sawSort = true;
    if (key === "$lookup" && !sawMatch) {
      warnings.push({
        kind: "aggregation-bottleneck",
        severity: "warn",
        message: `Aggregation on ${event.collection} joins before filtering ($lookup before $match).`,
        suggestion: "Reduce input cardinality with $match before $lookup.",
        query: event,
      });
    }
  }
  if (sawSort && !pipeline.some((s) => Object.keys(s)[0] === "$limit")) {
    warnings.push({
      kind: "aggregation-bottleneck",
      severity: "info",
      message: `Aggregation sorts ${event.collection} without $limit.`,
      suggestion: "Add $limit after $sort to avoid sorting the entire dataset in memory.",
      query: event,
    });
  }
  return warnings;
}
