# tenantforge

**Topics:** `express` · `mern` · `mern-packages` · `merndev` · `middleware` · `mongodb` · `multi-tenant` · `nodejs` · `npm-pm` · `observability` · `saas` · `tenantforge` · `typescript`

**Multi-tenant guard** for Express: reads **`x-tenant-id`** (configurable), supports an optional allow-list, attaches **`req.tenantId`**, and ships `tenantScope()` for Mongo filters.

```ts
import { tenantforge, tenantScope } from "@mr-aftab-ahmad-khan/tenantforge";

app.use(tenantforge({ allowList: new Set(process.env.TENANT_ALLOWLIST!.split(",")) }));

app.get("/items", async (req, res) => {
  const items = await Item.find(tenantScope(req.tenantId));
  res.json(items);
});
```

## License

MIT
