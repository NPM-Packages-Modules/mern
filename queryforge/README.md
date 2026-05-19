# queryforge

**Topics:** `dashboard` · `filter` · `mern-packages` · `merndev` · `mongodb` · `nodejs` · `npm-pm` · `observability` · `query` · `queryforge` · `rest` · `typescript`

**Dynamic query builder** — convert `req.query` into **Mongo-style** `filter` / `sort` / `skip` / `limit` with explicit operator suffixes (`_gte`, `_in`, …) so dashboards stop reinventing filtering.

## Install

```bash
npm install @mr-aftab-ahmad-khan/queryforge
```

## Example

```typescript
import { parseListQuery } from "@mr-aftab-ahmad-khan/queryforge";

const { filter, sort, skip, limit } = parseListQuery(req.query as Record<string, string | undefined>, {
  allowed: ["status", "ownerId", "createdAt", "price"],
  page: { defaultLimit: 25, maxLimit: 200 },
});
// collection.find(filter).sort(sort).skip(skip).limit(limit)
```

## License

MIT
