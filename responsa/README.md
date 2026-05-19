# responsa

**Topics:** `api` · `envelope` · `error` · `express` · `mern-packages` · `merndev` · `middleware` · `nodejs` · `npm-pm` · `observability` · `pagination` · `responsa` · `response` · `standard` · `trace` · `typescript`

Standardize every API response your Express app sends — typed envelopes, paginated lists, structured errors, and a per-request trace ID — in one tiny middleware.

## Why

Every team reinvents `{ success, data, error, meta, pagination }`. `responsa` ships a battle-tested envelope, an `ApiError` class with HTTP helpers, and an error handler that catches everything (including native `throw`s) and emits consistent payloads.

## Install

```bash
npm install @mr-aftab-ahmad-khan/responsa
```

## Usage

```ts
import express from "express";
import { responsa, errorHandler, ApiError, notFound } from "@mr-aftab-ahmad-khan/responsa";

const app = express();
app.use(express.json());
app.use(responsa());

app.get("/users/:id", async (req, res, next) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return next(notFound("User not found"));
  res.success(user);
});

app.get("/users", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = 20;
  const [items, total] = await Promise.all([
    db.users.list({ page, pageSize }),
    db.users.count(),
  ]);
  res.paginated(items, { page, pageSize, total });
});

app.post("/users", (req, res, next) => {
  if (!req.body.email) return next(new ApiError("email required", { status: 422 }));
  res.created({ id: "u_1", ...req.body });
});

app.use(errorHandler());
```

### Success envelope

```json
{
  "success": true,
  "data": { "id": 1 },
  "meta": { "traceId": "tr_…", "timestamp": "2026-…", "durationMs": 8 }
}
```

### Paginated envelope

```json
{
  "success": true,
  "data": [ … ],
  "pagination": { "page": 2, "pageSize": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": true },
  "meta": { "traceId": "tr_…", "timestamp": "2026-…", "durationMs": 12 }
}
```

### Error envelope

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "User not found", "status": 404 },
  "meta": { "traceId": "tr_…", "timestamp": "2026-…", "durationMs": 2 }
}
```

## Response helpers (typed)

| Method | What it does |
| --- | --- |
| `res.success(data)` | 200 + success envelope |
| `res.created(data)` | 201 + success envelope |
| `res.noContent()` | 204 + empty body |
| `res.paginated(items, { page, pageSize, total })` | 200 + paginated envelope |
| `res.error(message, { status, code, details })` | error envelope |
| `res.fail(err)` | normalize any error into the error envelope |

## Error helpers

```ts
import {
  ApiError, badRequest, unauthorized, forbidden,
  notFound, conflict, unprocessable, tooManyRequests, internal,
} from "@mr-aftab-ahmad-khan/responsa";
```

Each helper returns an `ApiError` with the right status, default error code, and exposure flag.

## Options

```ts
responsa({
  traceIdHeader: "x-trace-id",
  exposeTraceIdHeader: true,
  generateTraceId: () => crypto.randomUUID(),
  defaultErrorStatus: 500,
  defaultErrorCode: "INTERNAL_ERROR",
  includeStack: false,
  errorMapper: (err) =>
    err && typeof err === "object" && "code" in err && err.code === "P2002"
      ? { status: 409, code: "CONFLICT", message: "Duplicate" }
      : undefined,
});
```

`errorMapper` lets you map Prisma/Mongo/library-specific errors to the standard envelope.

## TypeScript

`responsa` augments Express' `Response` with `success`, `created`, `paginated`, `error`, `fail`, and `traceId`. Import the package once anywhere in your project and the methods become typed everywhere.

## License

MIT
