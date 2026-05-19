import type express from "express";

export interface CacheEntry {
  status: number;
  body: string;
  headers: Record<string, string>;
  expiresAt: number;
}

export type CacheStore = {
  get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  set(key: string, entry: CacheEntry): Promise<void> | void;
  delete(key: string): Promise<void> | void;
};

export class MemoryCacheStore implements CacheStore {
  private map = new Map<string, CacheEntry>();
  get(key: string) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e;
  }
  set(key: string, entry: CacheEntry) {
    this.map.set(key, entry);
  }
  delete(key: string) {
    this.map.delete(key);
  }
}

export interface CachemeshOptions {
  ttlMs: number;
  methods?: string[];
  key?: (req: express.Request) => string;
  store?: CacheStore;
}

/** Express middleware: caches JSON/text responses for GET (configurable). */
export function cachemesh(opts: CachemeshOptions) {
  const store = opts.store ?? new MemoryCacheStore();
  const methods = new Set((opts.methods ?? ["GET"]).map((m) => m.toUpperCase()));
  const keyOf = opts.key ?? ((req) => `${req.method}:${req.originalUrl || req.url}`);

  const middleware: express.RequestHandler = async (req, res, next) => {
    if (!methods.has(req.method)) return next();
    const key = keyOf(req);
    const hit = await Promise.resolve(store.get(key));
    if (hit && hit.expiresAt > Date.now()) {
      res.status(hit.status);
      for (const [h, v] of Object.entries(hit.headers)) res.setHeader(h, v);
      res.send(hit.body);
      return;
    }

    const origSend = res.send.bind(res);
    res.send = (body?: unknown) => {
      const chunk = typeof body === "string" ? body : JSON.stringify(body);
      const ct = res.getHeader("content-type");
      const headers: Record<string, string> = {};
      if (typeof ct === "string") headers["content-type"] = ct;
      void Promise.resolve(
        store.set(key, {
          status: res.statusCode,
          body: chunk,
          headers,
          expiresAt: Date.now() + opts.ttlMs,
        }),
      );
      return origSend(body as never);
    };
    next();
  };
  return Object.assign(middleware, {
    invalidate: (key: string) => store.delete(key),
    store,
  });
}

export type CachemeshMiddleware = ReturnType<typeof cachemesh>;
