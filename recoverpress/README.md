# recoverpress

**Topics:** `errors` · `express` · `mern-packages` · `merndev` · `middleware` · `nodejs` · `npm-pm` · `observability` · `recoverpress` · `resilience` · `retry` · `typescript`

**Express auto error recovery** — classify failures, return **degraded** JSON payloads for known outages, and **`withRetry`** wrapper helpers for transient I/O faults.

## Install

```bash
npm install @mr-aftab-ahmad-khan/recoverpress express
```

## Example

```typescript
import express from "express";
import { recoverpress, withRetry } from "@mr-aftab-ahmad-khan/recoverpress";

const app = express();

app.get("/feed", async (_req, res, next) => {
  try {
    const html = await withRetry(() => fetch("https://api.vendor/status").then((r) => r.text()), {
      maxAttempts: 3,
    });
    res.type("html").send(html);
  } catch (e) {
    next(e);
  }
});

app.use(
  recoverpress({
    classify: (err) => (String((err as Error).message).includes("vendor") ? "degraded" : "fatal"),
    degradedResponse: () => ({
      status: 503,
      body: { error: "upstream_unavailable", retryAfter: 30 },
    }),
  })
);
```

## License

MIT
