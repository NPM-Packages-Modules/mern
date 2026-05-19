import type express from "express";

export interface RatemeshOptions {
  windowMs: number;
  max: number;
  /** Reduce limit after burst of client errors inside the window. */
  adaptive?: boolean;
  errorThreshold?: number;
  penaltyFactor?: number;
  key?: (req: express.Request) => string;
}

const windows = new Map<string, { hits: number[]; errors: number[] }>();

function bucket(key: string, windowMs: number) {
  let w = windows.get(key);
  if (!w) {
    w = { hits: [], errors: [] };
    windows.set(key, w);
  }
  const now = Date.now();
  w.hits = w.hits.filter((t) => t > now - windowMs);
  w.errors = w.errors.filter((t) => t > now - windowMs);
  return w;
}

export function ratemesh(opts: RatemeshOptions) {
  const keyOf = opts.key ?? ((req) => req.ip ?? req.socket.remoteAddress ?? "unknown");
  const errTh = opts.errorThreshold ?? 8;
  const pen = opts.penaltyFactor ?? 0.5;

  const middleware: express.RequestHandler = (req, res, next) => {
    const key = keyOf(req);
    const w = bucket(key, opts.windowMs);
    let limit = opts.max;
    if (opts.adaptive && w.errors.length >= errTh) {
      limit = Math.max(1, Math.floor(opts.max * pen));
    }
    if (w.hits.length >= limit) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: opts.windowMs });
      return;
    }
    w.hits.push(Date.now());

    res.on("finish", () => {
      if (res.statusCode >= 400 && res.statusCode < 500 && opts.adaptive) {
        const bw = bucket(key, opts.windowMs);
        bw.errors.push(Date.now());
      }
    });
    next();
  };
  return middleware;
}

export function __resetRatemeshForTests(): void {
  windows.clear();
}
