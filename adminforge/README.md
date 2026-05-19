# adminforge

**Topics:** `admin` · `adminforge` · `crud` · `dashboard` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `schema` · `typescript`

**Auto admin panel generator (core)** — describe models once (`path`, `fields`, optional relations) and emit a versioned **JSON manifest** your React/Next admin shell can render as CRUD tables + forms.

## Install

```bash
npm install @mr-aftab-ahmad-khan/adminforge
```

## Example

```typescript
import { adminModel, buildAdminManifest } from "@mr-aftab-ahmad-khan/adminforge";

const manifest = buildAdminManifest([
  adminModel({
    name: "Order",
    path: "/api/orders",
    fields: [
      { key: "_id", type: "id", readonly: true },
      { key: "total", type: "number" },
      { key: "userId", type: "id", relation: { resource: "User", labelField: "email" } },
    ],
  }),
]);

// expose manifest.json from your API or bundle it in the admin app
```

## License

MIT
