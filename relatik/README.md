# relatik

**Auto CRUD relationship engine** for Express and Mongo-style models.

Generate production-oriented REST routers from a small adapter: **relationship scoping** (nested resources), **pagination**, **filter & search** query parsing, **`populate` hints**, **soft deletes**, and optional **Zod** validation — without hand-writing the same controllers again.

## Install

```bash
npm install @mr-aftab-ahmad-khan/relatik express zod
```

## Usage

```typescript
import express from "express";
import { createRelatikRouter, type CrudAdapter, type ParsedListParams } from "@mr-aftab-ahmad-khan/relatik";

const adapter: CrudAdapter<{ _id: string; name: string; userId: string }> = {
  async list(params: ParsedListParams) {
    /* merge params.filter, params.searchOr, params.sort, skip/limit */
    return { items: [], total: 0 };
  },
  async getById(id, { populate }) {
    return null;
  },
  async create(body) {
    return { _id: "1", name: "x", userId: "u" };
  },
  async patch(id, body) {
    return null;
  },
  softDelete: async (id) => ({ _id: id, name: "", userId: "" }),
};

const app = express();
app.use(express.json());
app.use("/posts", createRelatikRouter({ adapter, listOptions: { searchFields: ["name"] } }));
app.use(
  "/users/:userId/posts",
  createRelatikRouter({
    adapter,
    scopeFromRequest: (req) => ({ userId: req.params.userId }),
  })
);
```

## License

MIT
