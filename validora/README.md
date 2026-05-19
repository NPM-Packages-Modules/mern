# validora

**Topics:** `api` · `express` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `schema` · `typescript` · `validation` · `validora` · `zod`

**validora** is thin **Express middleware** around **Zod** for **`body`** and **`query`** — re-exporting **`z`** for one import line in MERN apps.

```ts
import express from "express";
import { validateBody, z } from "@mr-aftab-ahmad-khan/validora";

app.post("/signup", validateBody(z.object({ email: z.string().email() })), handler);
```

MIT © Aftab Ahmad Khan
