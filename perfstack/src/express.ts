import { randomBytes } from "node:crypto";
import type { Profiler } from "./profiler.js";

type ReqLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
  headers: Record<string, string | string[] | undefined>;
};
type ResLike = {
  statusCode: number;
  on(event: "finish", cb: () => void): void;
  setHeader(name: string, value: string): void;
};
type NextLike = () => void;

export interface ExpressMiddlewareOptions {
  ignorePaths?: string[];
  traceHeader?: string;
  exposeTraceHeader?: boolean;
}

export function expressMiddleware(
  profiler: Profiler,
  options: ExpressMiddlewareOptions = {},
): (req: ReqLike, res: ResLike, next: NextLike) => void {
  const { ignorePaths = [], traceHeader = "x-trace-id", exposeTraceHeader = true } = options;
  return function perfstackMiddleware(req, res, next) {
    const path = req.originalUrl ?? req.url ?? "/";
    if (ignorePaths.some((p) => path === p || path.startsWith(`${p}/`))) {
      next();
      return;
    }

    const traceHeaderVal = req.headers[traceHeader.toLowerCase()];
    const traceId =
      (typeof traceHeaderVal === "string" && traceHeaderVal) ||
      (Array.isArray(traceHeaderVal) && traceHeaderVal[0]) ||
      `req_${randomBytes(8).toString("hex")}`;

    if (exposeTraceHeader) res.setHeader(traceHeader, traceId);

    const startedAt = Date.now();

    profiler.tracer.runInContext(traceId, () => {
      res.on("finish", () => {
        profiler.recordHttp({
          method: req.method ?? "GET",
          path: req.route?.path ?? simplifyPath(path),
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          startedAt,
          traceId,
        });
      });
      next();
    });
  };
}

export function dashboardMiddleware(
  profiler: Profiler,
): (req: ReqLike, res: ResLikeWithSend, next: NextLike) => void {
  return function perfstackDashboard(req, res) {
    const path = req.originalUrl ?? req.url ?? "/";
    if (path.endsWith(".json")) {
      res.setHeader("content-type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify(profiler.report(), null, 2));
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.statusCode = 200;
    res.end(renderDashboard(profiler));
  };
}

type ResLikeWithSend = ResLike & {
  statusCode: number;
  end(payload?: string): void;
};

function simplifyPath(p: string): string {
  return p
    .split("?")[0]!
    .replace(/\/[0-9a-f]{24}\b/gi, "/:id")
    .replace(/\/\d+\b/g, "/:id");
}

function renderDashboard(profiler: Profiler): string {
  const report = profiler.report();
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>perfstack</title>
<style>
body{font:14px/1.4 ui-monospace,Menlo,monospace;background:#0b1020;color:#e6e6e6;margin:0;padding:24px}
h1,h2{font-weight:600;margin:0 0 12px}h2{margin-top:24px}
table{border-collapse:collapse;width:100%;margin-top:8px}
th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #1d2440}
th{color:#8aa6ff;font-weight:600}
.bad{color:#ff8a8a}.good{color:#8aff9c}
.card{background:#121838;border-radius:8px;padding:16px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.k{color:#8a93b3}.v{font-size:20px;font-weight:600}
</style></head>
<body>
<h1>perfstack</h1>
<div class="grid">
  <div class="card"><div class="k">uptime</div><div class="v">${Math.round(report.uptimeMs / 1000)}s</div></div>
  <div class="card"><div class="k">requests</div><div class="v">${report.totalRequests}</div></div>
  <div class="card"><div class="k">errors</div><div class="v ${report.totalErrors ? "bad" : "good"}">${report.totalErrors}</div></div>
  <div class="card"><div class="k">queries</div><div class="v">${report.totalQueries}</div></div>
</div>

<h2>HTTP latency (ms)</h2>
<table><tr><th>count</th><th>min</th><th>avg</th><th>p50</th><th>p90</th><th>p95</th><th>p99</th><th>max</th></tr>
<tr><td>${report.http.count}</td><td>${report.http.min}</td><td>${report.http.avg}</td><td>${report.http.p50}</td><td>${report.http.p90}</td><td>${report.http.p95}</td><td>${report.http.p99}</td><td>${report.http.max}</td></tr>
</table>

<h2>Slowest routes (p95)</h2>
<table><tr><th>route</th><th>count</th><th>p95</th><th>p99</th><th>max</th><th>errors</th></tr>
${report.slowestRoutes
  .map((r) => `<tr><td>${escapeHtml(r.method)} ${escapeHtml(r.path)}</td><td>${r.count}</td><td>${r.p95}</td><td>${r.p99}</td><td>${r.max}</td><td>${r.errorCount}</td></tr>`)
  .join("\n")}
</table>

<h2>Slowest queries</h2>
<table><tr><th>collection</th><th>op</th><th>duration</th></tr>
${report.slowestQueries
  .map((q) => `<tr><td>${escapeHtml(q.collection)}</td><td>${escapeHtml(q.op)}</td><td>${q.durationMs}ms</td></tr>`)
  .join("\n")}
</table>

<h2>Memory</h2>
<table><tr><th>rss</th><th>heap used</th><th>heap total</th><th>peak rss</th><th>peak heap</th></tr>
<tr>
  <td>${fmtBytes(report.memory.current?.rss ?? 0)}</td>
  <td>${fmtBytes(report.memory.current?.heapUsed ?? 0)}</td>
  <td>${fmtBytes(report.memory.current?.heapTotal ?? 0)}</td>
  <td>${fmtBytes(report.memory.peakRss)}</td>
  <td>${fmtBytes(report.memory.peakHeapUsed)}</td>
</tr>
</table>

</body></html>`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
