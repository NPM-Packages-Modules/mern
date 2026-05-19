import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";
import type { ZodTypeAny } from "zod";

export type RelatikSortDirection = 1 | -1;

export interface ListQuery {
  page?: string;
  limit?: string;
  sort?: string;
  q?: string;
  populate?: string;
  [key: string]: string | string[] | undefined;
}

export interface ParsedListParams {
  filter: Record<string, unknown>;
  skip: number;
  limit: number;
  sort: Record<string, RelatikSortDirection>;
  /** Or `$or` fragment for Mongo when searchFields used */
  searchOr?: Record<string, unknown>[];
  populate?: string | string[];
}

export interface BuildListParamsOptions {
  allowedFilterFields?: string[];
  /** Build case-insensitive regex `$or` across these fields when `q` is present */
  searchFields?: string[];
  defaultLimit?: number;
  maxLimit?: number;
}

const RESERVED = new Set(["page", "limit", "sort", "q", "populate"]);

export function buildListParams(query: ListQuery, opts?: BuildListParamsOptions): ParsedListParams {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 100;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  let limit = Number.parseInt(String(query.limit ?? String(defaultLimit)), 10) || defaultLimit;
  limit = Math.min(maxLimit, Math.max(1, limit));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  const allowed = opts?.allowedFilterFields;
  for (const [k, v] of Object.entries(query)) {
    if (RESERVED.has(k)) continue;
    if (allowed && !allowed.includes(k)) continue;
    if (v === undefined) continue;
    filter[k] = Array.isArray(v) ? v[0] : v;
  }

  const sort: Record<string, RelatikSortDirection> = {};
  const sortStr = String(query.sort ?? "");
  if (sortStr) {
    for (const part of sortStr.split(",")) {
      const [field, dir] = part.trim().split(":");
      if (!field) continue;
      sort[field] = dir === "desc" ? -1 : 1;
    }
  }

  let searchOr: Record<string, unknown>[] | undefined;
  const q = String(query.q ?? "").trim();
  if (q && opts?.searchFields?.length) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(esc, "i");
    searchOr = opts.searchFields.map((f) => ({ [f]: { $regex: rx } }));
  }

  const pop = query.populate;
  let populate: string | string[] | undefined;
  if (typeof pop === "string") populate = pop.includes(",") ? pop.split(",").map((s) => s.trim()) : pop;
  else if (Array.isArray(pop)) populate = pop;

  return { filter, skip, limit, sort, searchOr, populate };
}

export interface CrudAdapter<TDoc> {
  list: (params: ParsedListParams) => Promise<{ items: TDoc[]; total: number }>;
  getById: (id: string, params: { populate?: string | string[] }) => Promise<TDoc | null>;
  create: (body: unknown) => Promise<TDoc>;
  patch: (id: string, body: unknown) => Promise<TDoc | null>;
  delete?: (id: string) => Promise<TDoc | null>;
  softDelete?: (id: string) => Promise<TDoc | null>;
}

export interface RelatikRouterOptions<TDoc> {
  adapter: CrudAdapter<TDoc>;
  validateCreate?: ZodTypeAny;
  validatePatch?: ZodTypeAny;
  listOptions?: BuildListParamsOptions;
  /** Merge into list `filter` and enforce on get/patch/delete (e.g. nested `userId` from parent route) */
  scopeFromRequest?: (req: Request) => Record<string, unknown>;
  authorize?: (
    action: "list" | "read" | "create" | "update" | "delete"
  ) => (req: Request, res: Response, next: NextFunction) => void;
}

function applyScope(scope: Record<string, unknown>, params: ParsedListParams): ParsedListParams {
  return {
    ...params,
    filter: { ...params.filter, ...scope },
  };
}

function parseZod(schema: ZodTypeAny | undefined, body: unknown): { ok: true; data: unknown } | { ok: false } {
  if (!schema) return { ok: true, data: body };
  const r = schema.safeParse(body);
  if (!r.success) return { ok: false };
  return { ok: true, data: r.data };
}

/**
 * Attach standard REST handlers: `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
 * Use `adapter.softDelete` to map DELETE to a non-destructive update.
 */
export function createRelatikRouter<TDoc>(opts: RelatikRouterOptions<TDoc>): import("express").Router {
  const router = Router();
  const { adapter, listOptions, scopeFromRequest } = opts;

  const scope = (req: Request): Record<string, unknown> => scopeFromRequest?.(req) ?? {};

  const maybeAuth = (action: Parameters<NonNullable<RelatikRouterOptions<TDoc>["authorize"]>>[0]): RequestHandler[] =>
    opts.authorize ? [opts.authorize(action)] : [];

  router.get(
    "/",
    ...maybeAuth("list"),
    async (req, res, next) => {
      try {
        let params = buildListParams(req.query as ListQuery, listOptions);
        const s = scope(req);
        if (Object.keys(s).length) params = applyScope(s, params);
        const out = await adapter.list(params);
        res.json({ items: out.items, total: out.total, page: Math.floor(params.skip / params.limit) + 1, limit: params.limit });
      } catch (e) {
        next(e);
      }
    }
  );

  router.get(
    "/:id",
    ...maybeAuth("read"),
    async (req, res, next) => {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ error: "missing_id" });
          return;
        }
        const doc = await adapter.getById(id, { populate: buildListParams(req.query as ListQuery, {}).populate });
        if (!doc) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const s = scope(req);
        if (Object.keys(s).length && !Object.entries(s).every(([k, v]) => (doc as Record<string, unknown>)[k] === v)) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        res.json(doc);
      } catch (e) {
        next(e);
      }
    }
  );

  router.post(
    "/",
    ...maybeAuth("create"),
    async (req, res, next) => {
      try {
        const parsed = parseZod(opts.validateCreate, req.body);
        if (!parsed.ok) {
          res.status(400).json({ error: "invalid_body" });
          return;
        }
        const body =
          Object.keys(scope(req)).length > 0 ? { ...(parsed.data as object), ...scope(req) } : parsed.data;
        const doc = await adapter.create(body);
        res.status(201).json(doc);
      } catch (e) {
        next(e);
      }
    }
  );

  router.patch(
    "/:id",
    ...maybeAuth("update"),
    async (req, res, next) => {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ error: "missing_id" });
          return;
        }
        const parsed = parseZod(opts.validatePatch, req.body);
        if (!parsed.ok) {
          res.status(400).json({ error: "invalid_body" });
          return;
        }
        const existing = await adapter.getById(id, {});
        if (!existing) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const s = scope(req);
        if (Object.keys(s).length && !Object.entries(s).every(([k, v]) => (existing as Record<string, unknown>)[k] === v)) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const doc = await adapter.patch(id, parsed.data);
        if (!doc) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        res.json(doc);
      } catch (e) {
        next(e);
      }
    }
  );

  router.delete(
    "/:id",
    ...maybeAuth("delete"),
    async (req, res, next) => {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ error: "missing_id" });
          return;
        }
        if (!adapter.softDelete && !adapter.delete) {
          res.status(501).json({ error: "delete_not_supported" });
          return;
        }
        const existing = await adapter.getById(id, {});
        if (!existing) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const s = scope(req);
        if (Object.keys(s).length && !Object.entries(s).every(([k, v]) => (existing as Record<string, unknown>)[k] === v)) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const doc = adapter.softDelete ? await adapter.softDelete(id) : await adapter.delete!(id);
        if (!doc) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        res.status(204).send();
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
