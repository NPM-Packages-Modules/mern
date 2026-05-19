import type { ErrorOccurrence, ErrorReport, ErrorReporter } from "./types.js";

export class InMemoryReporter implements ErrorReporter {
  private map = new Map<string, ErrorOccurrence>();
  private max: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.max = options.maxEntries ?? 500;
  }

  record(report: ErrorReport): void {
    const existing = this.map.get(report.fingerprint);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = report.occurredAt;
      existing.sample = report;
      return;
    }
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(report.fingerprint, {
      fingerprint: report.fingerprint,
      count: 1,
      firstSeen: report.occurredAt,
      lastSeen: report.occurredAt,
      sample: report,
    });
  }

  list(opts: { minCount?: number } = {}): ErrorOccurrence[] {
    const min = opts.minCount ?? 1;
    return Array.from(this.map.values())
      .filter((o) => o.count >= min)
      .sort((a, b) => b.count - a.count);
  }

  get(fingerprint: string): ErrorOccurrence | undefined {
    return this.map.get(fingerprint);
  }

  reset(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}
