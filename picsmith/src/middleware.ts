import { statSync } from "node:fs";
import { TransformOptionsSchema, type ImagoOptions, type SourceAdapter, type TransformOptions } from "./types.js";
import { FileSystemSource } from "./source.js";
import { transform } from "./transform.js";
import { DiskCache, LruCache, makeCacheKey, type Cache } from "./cache.js";
import { ImagoError, SourceNotFoundError } from "./errors.js";

function resolveSource(opts: ImagoOptions): SourceAdapter {
  if (typeof opts.source === "string") return new FileSystemSource(opts.source);
  return opts.source;
}

function resolveCache(opts: ImagoOptions): Cache {
  if (!opts.cache) return new LruCache();
  if (typeof opts.cache === "string") return new DiskCache(opts.cache);
  if (opts.cache.dir) return new DiskCache(opts.cache.dir);
  return new LruCache(opts.cache.maxItems ?? 256);
}

export interface HandleResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export async function handle(
  opts: ImagoOptions,
  key: string,
  rawQuery: Record<string, string>,
  reqHeaders: Record<string, string | undefined>,
): Promise<HandleResult> {
  const source = resolveSource(opts);
  const cache = resolveCache(opts);
  const maxAge = opts.maxAge ?? 86400;

  const parsed = TransformOptionsSchema.safeParse(rawQuery);
  if (!parsed.success) {
    return jsonError(400, parsed.error.message);
  }
  const tOpts: TransformOptions = parsed.data;

  const fetched = await source.fetch(key);
  if (!fetched) {
    return jsonError(404, "Source not found", key);
  }

  let mtime = 0;
  if (typeof opts.source === "string") {
    try { mtime = statSync(`${opts.source}/${key}`).mtimeMs; } catch { /* ignore */ }
  }
  const cacheKey = makeCacheKey(key, tOpts, mtime);

  const cached = cache.get(cacheKey);
  const accept = reqHeaders["accept"];
  let result;
  if (cached) {
    result = cached;
  } else {
    try {
      const transformed = await transform({
        source: fetched.buffer,
        options: tOpts,
        ...(accept !== undefined ? { accept } : {}),
        ...(opts.maxDimension !== undefined ? { maxDimension: opts.maxDimension } : {}),
      });
      result = { ...transformed, lastModified: new Date() };
      cache.set(cacheKey, result);
    } catch (err) {
      if (err instanceof ImagoError) return jsonError(err.status, err.message);
      throw err;
    }
  }

  const ifNoneMatch = reqHeaders["if-none-match"];
  if (ifNoneMatch && ifNoneMatch === result.etag) {
    return { status: 304, headers: { ETag: result.etag }, body: Buffer.alloc(0) };
  }

  return {
    status: 200,
    headers: {
      "content-type": result.mimeType,
      "cache-control": `public, max-age=${maxAge}, immutable`,
      etag: result.etag,
      "last-modified": result.lastModified.toUTCString(),
      "content-length": String(result.buffer.length),
    },
    body: result.buffer,
  };
}

function jsonError(status: number, message: string, extra?: string): HandleResult {
  const body = Buffer.from(JSON.stringify({ error: message, key: extra }));
  return {
    status,
    headers: { "content-type": "application/json", "content-length": String(body.length) },
    body,
  };
}

// -------------------- Express --------------------
export function imago(opts: ImagoOptions) {
  return async (req: any, res: any, next: (err?: unknown) => void) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { query[k] = v; });
      const result = await handle(opts, key, query, req.headers ?? {});
      res.status(result.status);
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
      res.end(result.body);
    } catch (err) {
      next(err);
    }
  };
}

// -------------------- Hono --------------------
export function imagoHono(opts: ImagoOptions) {
  return async (c: any) => {
    const url = new URL(c.req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });
    const reqHeaders: Record<string, string> = {};
    c.req.headers.forEach((v: string, k: string) => { reqHeaders[k.toLowerCase()] = v; });
    const result = await handle(opts, key, query, reqHeaders);
    return new Response(result.body, { status: result.status, headers: result.headers });
  };
}

// -------------------- Fastify --------------------
export function imagoFastify(opts: ImagoOptions) {
  return async (req: any, reply: any) => {
    const url = new URL(req.url, "http://localhost");
    const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });
    const result = await handle(opts, key, query, req.headers ?? {});
    reply.code(result.status);
    for (const [k, v] of Object.entries(result.headers)) reply.header(k, v);
    reply.send(result.body);
  };
}
