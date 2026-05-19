import type { RequestHandler, Router } from "express";

const kPagination = Symbol("apiblocks.pagination");
const kSearch = Symbol("apiblocks.search");

export interface PaginationState {
  page: number;
  limit: number;
  skip: number;
}

export interface ApiBlocksRequest {
  [kPagination]?: PaginationState;
  /** Regex from `q` + search fields, or `undefined` */
  [kSearch]?: RegExp | undefined;
}

function asBlocksReq(req: object): ApiBlocksRequest {
  return req as ApiBlocksRequest;
}

export interface ApiBlock {
  readonly name: string;
  readonly middleware?: RequestHandler[];
  /** Extend the mounted router after global middleware runs */
  readonly setup?: (router: Router) => void;
}

export function block(def: ApiBlock): ApiBlock {
  return def;
}

export function getPagination(req: object): PaginationState | undefined {
  return asBlocksReq(req)[kPagination];
}

export function getSearchRegex(req: object): RegExp | undefined {
  return asBlocksReq(req)[kSearch];
}

export function paginationBlock(opts?: { defaultLimit?: number; maxLimit?: number }): ApiBlock {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 100;
  return {
    name: "pagination",
    middleware: [
      (req, _res, next) => {
        const q = req.query as Record<string, string | string[] | undefined>;
        const page = Math.max(1, Number.parseInt(String(q.page ?? "1"), 10) || 1);
        let limit = Number.parseInt(String(q.limit ?? String(defaultLimit)), 10) || defaultLimit;
        limit = Math.min(maxLimit, Math.max(1, limit));
        asBlocksReq(req)[kPagination] = { page, limit, skip: (page - 1) * limit };
        next();
      },
    ],
  };
}

/** Reads `q` and exposes `getSearchRegex(req)` for Mongo `$regex` or SQL ILIKE builders. */
export function searchBlock(fields: string[]): ApiBlock {
  return {
    name: "search",
    middleware: [
      (req, _res, next) => {
        const q = String((req.query as { q?: string }).q ?? "").trim();
        if (!q || fields.length === 0) {
          asBlocksReq(req)[kSearch] = undefined;
          next();
          return;
        }
        const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        asBlocksReq(req)[kSearch] = new RegExp(esc, "i");
        void fields;
        next();
      },
    ],
  };
}

/** Flatten middleware, then run each `setup` in order. */
export function applyApiBlocks(router: Router, blocks: ApiBlock[]): void {
  for (const b of blocks) {
    for (const m of b.middleware ?? []) router.use(m);
  }
  for (const b of blocks) b.setup?.(router);
}
