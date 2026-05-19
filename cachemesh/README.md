# cachemesh

Express caching middleware with **TTL**, **custom cache keys**, and **`invalidate()`**. Ships with an in-memory store; swap in Redis by implementing `CacheStore`.

```ts
import express from "express";
import { cachemesh } from "@mr-aftab-ahmad-khan/cachemesh";

const app = express();
const apiCache = cachemesh({ ttlMs: 30_000 });
app.get("/users", apiCache, (_req, res) => res.json([]));
```

## License

MIT
