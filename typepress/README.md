# typepress

Type-safe API framework for Express. Define a route **once** and get:

- Runtime validation of `body`, `query`, `params`, and `response`
- Static TypeScript types for the handler context and return value
- An OpenAPI 3.1 document (`toOpenApi`)
- A typed fetch client you can ship to the frontend (`generateTypescriptClient`)

No code generation step required at runtime, no zod dependency — `typepress` includes a tiny `t` builder with the operators you actually need (`string`, `number`, `boolean`, `enums`, `literal`, `array`, `object`, `optional`, `union`).

## Install

```bash
npm install @mr-aftab-ahmad-khan/typepress
```

## Define routes

```ts
import express from "express";
import { createTypepress, t } from "@mr-aftab-ahmad-khan/typepress";

const api = createTypepress();

api.get<unknown, { limit: number }>(
  "/users",
  ({ query }) => db.users.list({ limit: query.limit }),
  {
    query: t.object({ limit: t.number({ integer: true, min: 1, max: 100 }) }),
    response: t.array(
      t.object({ id: t.string(), name: t.string(), email: t.string({ format: "email" }) }),
    ),
  },
);

api.post<{ name: string; email: string }>(
  "/users",
  ({ body }) => db.users.create(body),
  {
    body: t.object({
      name: t.string({ min: 1 }),
      email: t.string({ format: "email" }),
    }),
    response: t.object({ id: t.string(), name: t.string(), email: t.string() }),
  },
);

const app = express();
app.use(express.json());
api.attach(app);
app.listen(3000);
```

When validation fails:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "body.email: invalid email", "field": "body" } }
```

When the handler returns an invalid response (because you mis-implemented a field), `typepress` returns a 500 with `RESPONSE_VALIDATION` — so contract drift is caught in tests instead of the wild.

## OpenAPI

```ts
import { toOpenApi } from "@mr-aftab-ahmad-khan/typepress";

app.get("/openapi.json", (_req, res) => res.json(toOpenApi(api, {
  title: "My API",
  version: "1.0.0",
  servers: [{ url: "https://api.example.com" }],
})));
```

## Typed client for the frontend

```ts
import { generateTypescriptClient } from "@mr-aftab-ahmad-khan/typepress";
import { writeFileSync } from "node:fs";

writeFileSync(
  "./src/generated-client.ts",
  generateTypescriptClient(api, { className: "ApiClient" }),
);
```

Then in your React/Vue/etc. app:

```ts
import { ApiClient } from "./generated-client";

const api = new ApiClient({ baseUrl: "https://api.example.com" });
const users = await api.getUsers({ query: { limit: 20 } });
//    ^? Array<{ id: string; name: string; email: string }>
```

Errors thrown by the client have a `code`, `status`, and `message` mirroring the server envelope.

## API

| Symbol | What |
| --- | --- |
| `createTypepress()` | New router |
| `api.get/post/put/patch/delete(path, handler, schemas?)` | Register a route |
| `api.attach(expressApp)` | Wire all routes onto an Express app/Router |
| `api.list()` | Inspect registered routes (used by OpenAPI/client generators) |
| `toOpenApi(api, options?)` | Generate OpenAPI 3.1 document |
| `generateTypescriptClient(api, options?)` | Generate a typed fetch client |
| `t.string/number/boolean/literal/enums/array/object/optional/union/unknown` | Schema builder |

## License

MIT
