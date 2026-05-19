# cacheflow

**Topics:** `cache` · `cacheflow` · `invalidation` · `mern-packages` · `merndev` · `mongodb` · `nodejs` · `npm-pm` · `observability` · `redis` · `typescript`

**Auto cache invalidation engine** — declare reverse dependencies between **cache tags** and **data keys**; when models change, you receive the exact tags to purge (Redis, CDN, in-memory, etc.).

## Install

```bash
npm install @mr-aftab-ahmad-khan/cacheflow
```

## Example

```typescript
import { cacheflow } from "@mr-aftab-ahmad-khan/cacheflow";

const graph = cacheflow();

graph.track("GET /v1/orgs/:id/dashboard", [`Org:${orgId}`, `User:${ownerId}`]);
graph.track("GET /v1/posts/:slug", [`Post:${postId}`, `Org:${orgId}`]);

async function onOrgWrite(orgId: string, redis: { del: (k: string) => Promise<unknown> }) {
  const bust = graph.invalidateDeps(`Org:${orgId}`);
  await Promise.all([...bust].map((tag) => redis.del(tag)));
}
```

## License

MIT
