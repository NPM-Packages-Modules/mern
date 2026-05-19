import type { Request, RequestHandler } from "express";

export interface TenantforgeRequest extends Request {
  tenantId: string;
}

export interface TenantforgeOptions {
  /** Header containing tenant id (default `x-tenant-id`). */
  header?: string;
  /** Express `req` property name (default `tenantId`). */
  property?: keyof TenantforgeRequest;
  /** Optional allow-list of tenant ids; missing = any non-empty string allowed. */
  allowList?: Set<string>;
}

/** Require tenant header and attach `req.tenantId` (or custom property). */
export function tenantforge(opts: TenantforgeOptions = {}): RequestHandler {
  return (req, res, next) => {
    const id = req.get(opts.header ?? "x-tenant-id");
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "tenant_required" });
      return;
    }
    if (opts.allowList && !opts.allowList.has(id)) {
      res.status(403).json({ error: "tenant_forbidden" });
      return;
    }
    const prop = opts.property ?? "tenantId";
    Object.assign(req, { [prop]: id });
    next();
  };
}

/** Mongo-style filter helper for multi-tenant collections. */
export function tenantScope(tenantId: string): { tenantId: string } {
  return { tenantId };
}
