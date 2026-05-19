# mockpress

**Topics:** `api` · `express` · `mern-packages` · `merndev` · `mock` · `mockpress` · `nodejs` · `npm-pm` · `observability` · `testing` · `typescript`

**mockpress** builds a **parallel Express app** from an existing app’s top-level route table (via `routecheck`) and serves **mock JSON** with optional **latency** and **random fault** injection.

## Usage

```ts
import express from "express";
import { mockpress } from "@mr-aftab-ahmad-khan/mockpress";

const app = express();
app.get("/api/users", (_req, res) => res.json([]));

const mock = mockpress(app, { latencyMs: 50, errorRate: 0.01 });
mock.listen(4000);
```

MIT © Aftab Ahmad Khan
