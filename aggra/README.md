# aggra

**Topics:** `aggra` · `aggregation` · `mern-packages` · `merndev` · `mongodb` · `mongoose` · `nodejs` · `npm-pm` · `observability` · `pipeline` · `query` · `typescript`

**Mongo aggregation pipeline builder** — compose `$match`, `$lookup`, `$group`, and friends in a chain so pipelines stay readable and reusable.

## Install

```bash
npm install @mr-aftab-ahmad-khan/aggra
```

## Example

```typescript
import { pipeline } from "@mr-aftab-ahmad-khan/aggra";

const stages = pipeline()
  .match({ orgId: "o1", deletedAt: null })
  .lookup({ from: "users", localField: "ownerId", foreignField: "_id", as: "owner" })
  .unwind("$owner")
  .group({ _id: "$status", count: { $sum: 1 } })
  .sort({ count: -1 })
  .build();

// collection.aggregate(stages)
```

## License

MIT
