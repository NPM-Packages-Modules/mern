import type { Express, Request, RequestHandler, Response } from "express";
import express from "express";
import { listExpressRoutes } from "@mr-aftab-ahmad-khan/routecheck";

export interface MockpressOptions {
  /** Artificial delay before responding (ms). */
  latencyMs?: number;
  /** Chance 0–1 that a handler responds with 500 for chaos testing */
  errorRate?: number;
}

function registerRoute(
  mock: Express,
  method: string,
  path: string,
  handler: RequestHandler,
): void {
  const m = method.toUpperCase();
  if (m === "GET") mock.get(path, handler);
  else if (m === "POST") mock.post(path, handler);
  else if (m === "PUT") mock.put(path, handler);
  else if (m === "PATCH") mock.patch(path, handler);
  else if (m === "DELETE") mock.delete(path, handler);
}

function mockBody(path: string, method: string) {
  return {
    _mock: true,
    method,
    path,
    generatedAt: new Date().toISOString(),
    item: { id: "mock_id", label: "mock", count: 0 },
    items: [{ id: "a" }, { id: "b" }],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeHandler(routePath: string, method: string, opts: MockpressOptions | undefined) {
  return async (_req: Request, res: Response) => {
    if (opts?.latencyMs) await sleep(opts.latencyMs);
    if (opts?.errorRate && Math.random() < opts.errorRate) {
      res.status(500).json({ error: "mock_fault" });
      return;
    }
    res.json(mockBody(routePath, method));
  };
}

/**
 * Build a **new** Express app that mirrors routes discovered on `sourceApp`
 * and serves deterministic mock JSON for frontend / contract tests.
 */
export function mockpress(sourceApp: Express, opts?: MockpressOptions): Express {
  const mock = express();
  mock.use(express.json());
  const routes = listExpressRoutes(sourceApp);
  for (const r of routes) {
    registerRoute(mock, r.method, r.path, makeHandler(r.path, r.method, opts));
  }
  return mock;
}
