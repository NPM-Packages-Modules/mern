# stacksense

**Topics:** `debugging` · `diagnostic` · `error` · `errors` · `express` · `fingerprint` · `mern-packages` · `merndev` · `middleware` · `nodejs` · `npm-pm` · `observability` · `stack-trace` · `stacksense` · `typescript`

Smart Express error intelligence. Turns ugly backend crashes into readable, fingerprinted, grouped diagnostic reports — with hints and suggested fixes for the most common Node/Express/Mongo failures.

## Why

Most teams ship Express apps with `app.use((err, req, res) => res.status(500).send('error'))`. `stacksense` upgrades that single line into:

- Stack trace parsing that highlights *in-app* frames
- A stable 12-character **fingerprint** per error (great for grouping/alerts)
- A pattern-matched **hint engine** for ECONNREFUSED, JWT issues, Mongo duplicate keys, CORS, EADDRINUSE, etc.
- A pluggable **reporter** that counts occurrences in memory (or your own store)
- Request snapshots (method, path, query, body, headers) with PII redaction
- One-call **GitHub issue formatting**: `reportToGithubIssue(report)`

## Install

```bash
npm install @mr-aftab-ahmad-khan/stacksense
```

## Use as Express middleware

```ts
import express from "express";
import { stacksense } from "@mr-aftab-ahmad-khan/stacksense";

const app = express();
app.use(express.json());

app.get("/users/:id", (req, _res, next) => {
  next(new Error(`user ${req.params.id} not found`));
});

app.use(stacksense({
  appRoots: [process.cwd()],
  includeRequestBody: true,
  exposeHeaders: true,
  pretty: process.env.NODE_ENV !== "production",
}));
```

Response body:

```json
{
  "success": false,
  "error": {
    "name": "Error",
    "message": "user 42 not found",
    "fingerprint": "9c7f6a1bb812",
    "hints": [],
    "suggestedFix": null
  }
}
```

Terminal output (when `pretty: true`):

```
✗ Error: user 42 not found
  fingerprint=9c7f6a1bb812  at=2026-…
  request=GET /users/42
  Hints:
    • …
  Stack:
    • handler (src/routes/users.ts:21:9)
    · Layer.handle (node_modules/express/…)
```

## Use the reporter directly

```ts
import { createStacksense } from "@mr-aftab-ahmad-khan/stacksense";

const sense = createStacksense();

app.use(sense.middleware);

app.get("/__errors", (_req, res) => res.json(sense.list()));
app.get("/__errors/:fp", (req, res) => res.json(sense.inspect(req.params.fp)));
```

## Generate a GitHub issue from any crash

```ts
import { reportToGithubIssue } from "@mr-aftab-ahmad-khan/stacksense";

sense.middleware = (err, req, res, next) => { /* … */ };

const { title, body } = reportToGithubIssue(report);
await octokit.issues.create({ owner, repo, title, body });
```

## API

| Function | Purpose |
| --- | --- |
| `stacksense(options)` | Express error middleware |
| `createStacksense(options)` | Returns `{ middleware, reporter, list, inspect }` |
| `parseError(err, appRoots?)` | Pure stack + cause-chain parser |
| `fingerprintError(parsed)` | 12-char SHA1 fingerprint |
| `deriveHints(parsed)` | `{ hints, suggestedFix }` from built-in rule pack |
| `formatReport(report)` | Pretty terminal output |
| `reportToGithubIssue(report)` | `{ title, body }` markdown |
| `rootCauseSummary(parsed)` | One-line "outer <- inner <- root" |
| `InMemoryReporter` | Bounded LRU-style error store |

### Options

```ts
stacksense({
  appRoots: [process.cwd()],
  includeRequestBody: false,
  exposeHeaders: false,
  redactKeys: ["x-internal-key"],
  pretty: false,
  responseMode: "rich",         // "rich" | "minimal" | "passthrough"
  statusMapper: (err) => err instanceof ValidationError ? 422 : undefined,
  onError: (report) => sendToSlack(report),
  hintEngine: (err) => deriveHints(err).hints,
  reporter: new MyExternalReporter(),
});
```

`responseMode: "passthrough"` lets you chain `stacksense` *before* your own error handler — it still records and fingerprints, but defers the actual HTTP response.

## License

MIT
