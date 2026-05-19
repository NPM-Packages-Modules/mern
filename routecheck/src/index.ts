import type { Express } from "express";

export type RouteInfo = { method: string; path: string };

/**
 * Best-effort static extraction of routes registered on the root Express router.
 * Nested routers mounted with `app.use('/prefix', r)` require `routecheck` against that router separately.
 */
export function listExpressRoutes(app: Express): RouteInfo[] {
  const acc: RouteInfo[] = [];
  type Layer = { route?: { path: unknown; methods: Record<string, unknown> } };
  const stack = (app as Express & { _router?: { stack?: Layer[] } })._router?.stack ?? [];
  for (const layer of stack) {
    const route = layer.route;
    if (route && typeof route.path === "string" && route.methods) {
      for (const m of Object.keys(route.methods)) {
        if (route.methods[m]) {
          acc.push({ method: m.toUpperCase(), path: route.path });
        }
      }
    }
  }
  return acc;
}

export function generateVitestStub(routes: RouteInfo[]): string {
  const lines = routes.map(
    (r) =>
      `  it.todo('${r.method} ${r.path.replace(/'/g, "\\'")} — assert status + schema shape');`,
  );
  return `import { describe, it } from "vitest";\n\ndescribe("generated API checks", () => {\n${lines.join("\n")}\n});\n`;
}
