# perfstack

**Topics:** `dashboard` · `express` · `memory` · `mern-packages` · `merndev` · `mongodb` · `nodejs` · `npm-pm` · `observability` · `performance` · `perfstack` · `profiling` · `tracing` · `typescript`

Lightweight fullstack performance profiler for Node.js. One package gives you HTTP latency histograms, slow-query tracking (Mongoose), memory snapshots, async-context tracing, and a built-in dashboard endpoint — no agents, no SaaS, no dependencies.

## Install

```bash
npm install @mr-aftab-ahmad-khan/perfstack
```

## One-call setup

```ts
import express from "express";
import { init } from "@mr-aftab-ahmad-khan/perfstack";

const app = express();
const { profiler, mongoosePlugin } = init(app, {
  slowRequestThreshold: 500,
  slowQueryThreshold: 200,
  enableMemorySampling: true,
  dashboardPath: "/__perf",
});

// Optional: track every Mongoose query
import mongoose from "mongoose";
mongoose.plugin(mongoosePlugin);

app.get("/", (_req, res) => res.json({ hi: true }));
app.listen(3000);
```

Now open:

- `http://localhost:3000/__perf` — minimal HTML dashboard
- `http://localhost:3000/__perf.json` — full report as JSON

## What you get

```jsonc
{
  "uptimeMs": 124562,
  "totalRequests": 1820,
  "totalErrors": 3,
  "totalQueries": 4001,
  "http": { "count": 1820, "avg": 41.2, "p50": 18, "p95": 220, "p99": 612, "max": 1820 },
  "routes": [
    { "method": "GET", "path": "/users/:id", "count": 720, "p95": 188, "errorCount": 0 },
    ...
  ],
  "slowestRoutes": [ /* sorted by p95 */ ],
  "queries": { "count": 4001, "p95": 30, "p99": 102 },
  "slowestQueries": [ { "collection": "users", "op": "find", "durationMs": 612 } ],
  "memory": { "current": { "rss": 134217728, "heapUsed": 41943040 }, "peakRss": 156000000 }
}
```

## Pieces

```ts
import {
  Profiler,
  expressMiddleware,
  dashboardMiddleware,
  mongoosePlugin,
  Histogram,
  Tracer,
} from "@mr-aftab-ahmad-khan/perfstack";

const profiler = new Profiler({ slowRequestThreshold: 300 });

app.use(expressMiddleware(profiler));
app.get("/__perf", dashboardMiddleware(profiler));
app.get("/__perf.json", dashboardMiddleware(profiler));
mongoose.plugin(mongoosePlugin(profiler));
```

### Custom spans

```ts
await profiler.tracer.withSpan("send-email", async () => {
  await mailer.send(...);
});

const span = profiler.tracer.start("billing.charge", "external");
try {
  await stripe.charge(...);
  span.end({ status: "ok" });
} catch (err) {
  span.end({ error: err });
}
```

Spans inherit the request trace id automatically (`AsyncLocalStorage`).

### Memory sampling

```ts
const profiler = new Profiler({
  enableMemorySampling: true,
  memorySampleIntervalMs: 5_000,
  memorySamplesMax: 120, // last 10 minutes at 5s intervals
});
```

Disable any time with `profiler.stopMemorySampling()`.

### Histogram percentiles

`perfstack` keeps a rolling window of the last 1000 samples per metric and computes `min/avg/p50/p90/p95/p99/max` on demand.

## Why not Datadog / New Relic / Sentry?

You may still want them. `perfstack` is the *first* thing you reach for — when you want zero-config insight in dev, in tests, or in a small prod app. It runs in the same process, no auth, no UI to log into, no $$/month.

## License

MIT
