# hookmesh

**Topics:** `express` · `hmac` · `hookmesh` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `saas` · `typescript` · `webhook`

**hookmesh** provides **HMAC-SHA256 verification** (`sha256=<hex>` or raw hex), a trivial **in-process hook registry**, and **Express middleware** with **idempotency-key** deduplication (MVP — back with Redis for multi-instance).

```ts
import crypto from "crypto";
import express from "express";
import { webhookGuard } from "@mr-aftab-ahmad-khan/hookmesh";

app.post("/stripe", express.raw({ type: "*/*" }), webhookGuard({
  secret: process.env.WEBHOOK_SECRET!,
  getRawBody: (req) => (req.body as Buffer).toString("utf8"),
}), handler);
```

MIT © Aftab Ahmad Khan
