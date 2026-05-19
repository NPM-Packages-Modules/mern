import type { NextFunction, Request, Response } from "express";

export interface RouteBoostOpts {
  /** Surrogate key hint for shared HTTP caches */
  surrogateKey?: string;
  /** Short public cache in seconds (0 = no-store) */
  maxAgeSec?: number;
}

export function routeboost(opts: RouteBoostOpts = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  const maxAge = opts.maxAgeSec ?? 0;
  const surrogate = opts.surrogateKey;
  return (_req, res, next) => {
    res.setHeader("X-Routeboost", "1");
    if (surrogate) res.setHeader("Surrogate-Key", surrogate);
    if (maxAge > 0) res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
    else res.setHeader("Cache-Control", "private, no-cache");
    next();
  };
}
