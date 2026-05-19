# monguard

Runtime MongoDB query intelligence for **Mongoose**. Drop in one plugin and `monguard` analyzes every query your app runs — slow queries, missing indexes, N+1 hot-paths, duplicate fetches, aggregation pipelines that sort before they match, and more — with terminal warnings and a programmatic stats API.

## Why

Most MERN apps ship without anyone ever looking at query plans. Existing tooling (Atlas Profiler, Datadog APM, Sentry Performance) is heavy, requires dashboards, and costs money. `monguard` is the smallest possible thing that runs in your dev (or prod) process, in-band, and tells you exactly what to fix.

## Install

```bash
npm install @mr-aftab-ahmad-khan/monguard
```

(`mongoose` is a peer dependency — works with v7 and v8.)

## Use globally on every model

```ts
import mongoose from "mongoose";
import { monguard } from "@mr-aftab-ahmad-khan/monguard";

const sense = monguard({
  slowQueryThreshold: 300,
  duplicateThreshold: 5,
  duplicateWindowMs: 1000,
});

mongoose.plugin(sense.plugin);
```

Or attach to one schema only:

```ts
import { Schema, model } from "mongoose";
import { monguard } from "@mr-aftab-ahmad-khan/monguard";

const userSchema = new Schema({ email: String, name: String });
userSchema.index({ email: 1 });

const sense = monguard();
userSchema.plugin(sense.plugin);

export const User = model("User", userSchema);
```

## What it detects

| Warning | Triggered when |
| --- | --- |
| `slow-query` | a query exceeds `slowQueryThreshold` ms |
| `full-collection-scan` | a read op runs with an empty filter |
| `missing-index` | a filter targets fields not covered by any registered index |
| `duplicate-query` | the same fingerprinted query fires `>= duplicateThreshold` times within `duplicateWindowMs` |
| `n-plus-one` | duplicates exceed `2× duplicateThreshold` (escalated severity) |
| `large-result` | result set crosses `largeResultThreshold` |
| `aggregation-bottleneck` | pipeline sorts/joins before `$match`, or sorts without `$limit` |
| `missing-projection` | reads have no projection at all (opt-in) |

Example terminal warning:

```
[monguard WARN] Missing index on users for fields [tenantId, status].
  → Add an index: { status: 1, tenantId: 1 }
  op=find duration=412ms collection=users
```

## Programmatic API

```ts
const sense = monguard({ slowQueryThreshold: 200 });

mongoose.plugin(sense.plugin);

sense.onWarning((w) => {
  alerting.send(w.kind, w.message, { collection: w.query.collection });
});

setInterval(() => {
  console.log(sense.stats());
  // { totalQueries, slowQueries, warnings: { 'slow-query': 12, ... }, topSlow, topDuplicate }
}, 60_000);
```

Reset between requests/tests:

```ts
sense.reset();
```

## Options

```ts
monguard({
  slowQueryThreshold: 200,          // ms
  duplicateWindowMs: 1000,
  duplicateThreshold: 5,
  largeResultThreshold: 1000,
  warnOnFullScan: true,
  warnOnMissingIndex: true,
  warnOnMissingProjection: false,
  attachStackTrace: false,          // adds .stack to QueryEvent
  silent: false,                    // suppress logger
  logger: (line) => myLogger.warn(line),
  topSlowSize: 25,
  topDuplicateSize: 25,
});
```

## Pure helpers (no mongoose required)

```ts
import {
  extractFilterFields,
  indexCoversFields,
  isFullScan,
  suggestCompoundIndex,
  fingerprintQuery,
  Analyzer,
} from "@mr-aftab-ahmad-khan/monguard";
```

Use the `Analyzer` directly to integrate with any DB layer.

## Roadmap

- AI-powered fix suggestions
- Web dashboard
- Cloud-hosted aggregation
- Automated `db.collection.createIndex` runner

## License

MIT
