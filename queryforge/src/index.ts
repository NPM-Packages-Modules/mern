export type SortDir = 1 | -1;

export interface QueryForgeResult {
  filter: Record<string, unknown>;
  sort: Record<string, SortDir>;
  skip: number;
  limit: number;
}

export interface QueryForgeOptions {
  /** If set, only these logical fields (plus suffixed operators) are admitted */
  allowed?: string[];
  page?: { defaultLimit?: number; maxLimit?: number };
}

const RESERVED = new Set(["page", "limit", "sort"]);

function scalar(v: string): string | number | boolean {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

const OP_RE = /^(.+)_(gte|lte|gt|lt|ne|in|nin)$/;

/**
 * Parse `req.query` into `{ filter, sort, skip, limit }` suitable for Mongo adapters.
 *
 * - Equality: `status=active` -> `{ status: "active" }`
 * - Operators: `price_gte=10` -> `{ price: { $gte: 10 } }`
 * - Arrays: `tags_in=a,b` -> `{ tags: { $in: ["a","b"] } }`
 * - Sort: `sort=createdAt:desc,name:asc`
 */
export function parseListQuery(
  query: Record<string, string | string[] | undefined>,
  opts?: QueryForgeOptions
): QueryForgeResult {
  const defL = opts?.page?.defaultLimit ?? 20;
  const maxL = opts?.page?.maxLimit ?? 100;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  let limit = Number.parseInt(String(query.limit ?? String(defL)), 10) || defL;
  limit = Math.min(maxL, Math.max(1, limit));
  const skip = (page - 1) * limit;

  const sort: Record<string, SortDir> = {};
  const sortStr = String(query.sort ?? "");
  if (sortStr) {
    for (const part of sortStr.split(",")) {
      const [k, d] = part.trim().split(":");
      if (!k) continue;
      sort[k] = d === "desc" ? -1 : 1;
    }
  }

  const allowed = opts?.allowed ? new Set(opts.allowed) : undefined;
  const filter: Record<string, unknown> = {};

  const admit = (field: string) => !allowed || allowed.has(field);

  for (const [rawKey, rawVal] of Object.entries(query)) {
    if (RESERVED.has(rawKey) || rawVal === undefined) continue;
    const val = Array.isArray(rawVal) ? rawVal[0]! : rawVal;
    const opMatch = OP_RE.exec(rawKey);
    if (opMatch) {
      const field = opMatch[1]!;
      const op = opMatch[2]!;
      if (!admit(field)) continue;
      const mongoOp = `$${op}`;
      if (op === "in" || op === "nin") {
        filter[field] = { [mongoOp]: String(val).split(",").map((s) => s.trim()) };
      } else {
        const cur = filter[field];
        const branch =
          cur && typeof cur === "object" && !Array.isArray(cur)
            ? { ...(cur as Record<string, unknown>) }
            : {};
        branch[mongoOp] = scalar(String(val));
        filter[field] = branch;
      }
      continue;
    }
    if (!admit(rawKey)) continue;
    filter[rawKey] = scalar(String(val));
  }

  return { filter, sort, skip, limit };
}

export const queryforge = { parseListQuery };
