import type {
  CallRecord,
  ExperimentConfig,
  ExperimentRecord,
  ExperimentResult,
  ExperimentVariant,
  WinnerMetric,
} from "./types.js";

/** Deterministic 32-bit FNV-1a hash returning a stable [0, 1) for the given key. */
export function hashToUnit(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

export class PromptExperiment {
  readonly id: string;
  readonly variants: readonly ExperimentVariant[];
  private readonly totalWeight: number;
  private records: Record<string, ExperimentRecord> = {};

  constructor(config: ExperimentConfig) {
    if (config.variants.length < 2) {
      throw new Error("PromptExperiment requires at least 2 variants");
    }
    const totalWeight = config.variants.reduce((s, v) => s + v.weight, 0);
    if (totalWeight <= 0) throw new Error("Total variant weight must be > 0");
    this.id = config.id;
    this.variants = config.variants;
    this.totalWeight = totalWeight;
    for (const v of config.variants) {
      this.records[v.name] = {
        variantName: v.name,
        callCount: 0,
        totalLatencyMs: 0,
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        customMetrics: {},
      };
    }
  }

  assign(userKey: string): ExperimentVariant {
    const u = hashToUnit(`${this.id}:${userKey}`) * this.totalWeight;
    let cumulative = 0;
    for (const v of this.variants) {
      cumulative += v.weight;
      if (u < cumulative) return v;
    }
    return this.variants[this.variants.length - 1]!;
  }

  record(call: CallRecord): void {
    const r = this.records[call.variantName];
    if (!r) throw new Error(`Unknown variant: ${call.variantName}`);
    r.callCount += 1;
    r.totalLatencyMs += call.latencyMs;
    r.totalCostUsd += call.costUsd;
    r.totalInputTokens += call.inputTokens;
    r.totalOutputTokens += call.outputTokens;
    if (call.custom) {
      for (const [k, v] of Object.entries(call.custom)) {
        r.customMetrics[k] = (r.customMetrics[k] ?? 0) + v;
      }
    }
  }

  getResult(): ExperimentResult {
    const byVariant: Record<string, ExperimentRecord> = {};
    let totalCalls = 0;
    for (const [k, v] of Object.entries(this.records)) {
      byVariant[k] = { ...v, customMetrics: { ...v.customMetrics } };
      totalCalls += v.callCount;
    }
    return { experimentId: this.id, totalCalls, byVariant };
  }

  /**
   * Returns the winning variant by metric. For "cost" and "latency", lower-is-better.
   * For any other key, compares mean of `customMetrics[key]` and treats higher-is-better.
   */
  getWinner(metric: WinnerMetric = "cost"): ExperimentVariant {
    const scored = this.variants.map((v) => {
      const r = this.records[v.name]!;
      const count = Math.max(r.callCount, 1);
      let score: number;
      if (metric === "cost") score = -(r.totalCostUsd / count);
      else if (metric === "latency") score = -(r.totalLatencyMs / count);
      else score = (r.customMetrics[metric] ?? 0) / count;
      return { v, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.v;
  }
}
