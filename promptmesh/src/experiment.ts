import { stableHash } from "./hash.js";
import type { ExperimentConfig, Variant } from "./types.js";

export function pickVariant(
  config: ExperimentConfig,
  hashSeed: string,
): Variant {
  if (config.variants.length === 0) {
    throw new Error("Experiment has no variants");
  }
  const total = config.variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  if (total <= 0) {
    return config.variants[0]!;
  }
  const seed = `${config.hashKey ?? ""}::${hashSeed}`;
  const r = (stableHash(seed) % 10000) / 10000;
  let acc = 0;
  for (const v of config.variants) {
    acc += v.weight / total;
    if (r < acc) return v;
  }
  return config.variants[config.variants.length - 1]!;
}
