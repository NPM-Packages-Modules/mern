import type { BackoffConfig } from "./types.js";

export interface BackoffState {
  attempt: number;
  lastConnectedAt: number | null;
}

export const DEFAULT_BACKOFF: Required<BackoffConfig> = {
  initial: 1000,
  max: 30_000,
  multiplier: 2,
  jitter: 1,
  resetAfterMs: 60_000,
  maxAttempts: Number.POSITIVE_INFINITY,
};

export function nextDelay(cfg: BackoffConfig, attempt: number, rand: () => number = Math.random): number {
  const c = { ...DEFAULT_BACKOFF, ...cfg };
  const base = c.initial * Math.pow(c.multiplier, attempt);
  const capped = Math.min(c.max, base);
  if (c.jitter <= 0) return capped;
  if (c.jitter >= 1) return rand() * capped;
  const range = capped * c.jitter;
  return capped - range + rand() * range * 2;
}

export function shouldReset(cfg: BackoffConfig, connectedSinceMs: number): boolean {
  const c = { ...DEFAULT_BACKOFF, ...cfg };
  return connectedSinceMs >= c.resetAfterMs;
}
