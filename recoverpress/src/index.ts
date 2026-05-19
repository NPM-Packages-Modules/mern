import type { ErrorRequestHandler } from "express";

export type RecoverKind = "fatal" | "degraded";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Heuristic: network-ish Node error codes as transient. */
export function classifyTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: string }).code) : "";
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(code);
}

/** Retry `fn` when `isTransient` (defaults to {@link classifyTransient}). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; delayMs?: number; isTransient?: (err: unknown) => boolean }
): Promise<T> {
  const max = opts?.maxAttempts ?? 3;
  const isTransient = opts?.isTransient ?? classifyTransient;
  let last: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransient(e) || i === max - 1) throw e;
      await sleep(opts?.delayMs ?? 75 * (i + 1));
    }
  }
  throw last;
}

export interface RecoverPressOptions {
  /** If `degraded`, respond without calling `next(err)`. */
  classify?: (err: unknown) => RecoverKind;
  degradedResponse?: (err: unknown) => { status: number; body: unknown };
}

/**
 * Express error middleware — map recoverable outages to a safe JSON payload instead of a generic 500.
 */
export function recoverpress(opts: RecoverPressOptions = {}): ErrorRequestHandler {
  const classify = opts.classify ?? (() => "fatal" as RecoverKind);
  return (err, _req, res, next) => {
    if (classify(err) === "degraded" && opts.degradedResponse) {
      const r = opts.degradedResponse(err);
      res.status(r.status).json(r.body);
      return;
    }
    next(err);
  };
}
