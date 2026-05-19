import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}

export interface VersionpressOptions {
  /** Header name (default `x-api-version`) */
  header?: string;
  /** When header missing (default `1`) */
  defaultVersion?: string;
  /** If set, emit `Warning` when version ≤ this (deprecation signal) */
  warnIfLte?: string;
}

/** Attach `req.apiVersion` and optional deprecation Warning header. */
export function versionpress(opts: VersionpressOptions = {}): RequestHandler {
  const header = opts.header ?? "x-api-version";
  const def = opts.defaultVersion ?? "1";
  const lte = opts.warnIfLte;

  return (req, res, next) => {
    const v = req.get(header) ?? def;
    req.apiVersion = v;
    if (lte && v <= lte) {
      res.setHeader("Warning", `299 - "API version ${v} is deprecated"`);
    }
    next();
  };
}

/**
 * Strip a URL prefix (`/v1`) so routes can stay unversioned internally.
 * Mount before routers: `app.use('/v1', stripVersionPrefix('/v1'), router)`.
 */
export function stripVersionPrefix(prefix: string): RequestHandler {
  const p = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return (req, _res, next) => {
    if (req.path === p || req.path.startsWith(`${p}/`)) {
      req.url = req.url.replace(p, "") || "/";
    }
    next();
  };
}
