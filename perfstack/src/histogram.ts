import type { HistogramSummary } from "./types.js";

export class Histogram {
  private samples: number[] = [];
  private max: number;

  constructor(max = 1000) {
    this.max = max;
  }

  record(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.max) {
      this.samples.shift();
    }
  }

  summary(): HistogramSummary {
    const count = this.samples.length;
    if (count === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const sum = sorted.reduce((s, v) => s + v, 0);
    return {
      count,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      avg: round(sum / count),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
    };
  }

  reset(): void {
    this.samples = [];
  }
}

export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  const idx = Math.min(sortedAscending.length - 1, Math.floor(p * sortedAscending.length));
  return round(sortedAscending[idx]!);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
