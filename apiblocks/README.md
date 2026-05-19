# apiblocks

**Topics:** `api` · `apiblocks` · `composition` · `express` · `mern-packages` · `merndev` · `middleware` · `nodejs` · `npm-pm` · `observability` · `rest` · `typescript`

**Smart API composition** — plug pagination, search, and your own **blocks** into Express as one ordered middleware chain plus optional `setup` hooks.

## Install

```bash
npm install @mr-aftab-ahmad-khan/apiblocks express
```

## Example

Register blocks **before** `router.get` / `post` so composed middleware runs first.

```typescript
import express from "express";
import { applyApiBlocks, paginationBlock, searchBlock, getPagination, getSearchRegex } from "@mr-aftab-ahmad-khan/apiblocks";

const app = express();
const api = express.Router();
applyApiBlocks(api, [paginationBlock(), searchBlock(["title", "body"])]);
api.get("/posts", (req, res) => {
  const p = getPagination(req);
  const rx = getSearchRegex(req);
  res.json({ p, hasSearch: !!rx });
});
app.use("/v1", api);
```

## License

MIT
