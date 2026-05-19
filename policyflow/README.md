# policyflow

**Topics:** `authorization` · `express` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `permissions` · `policyflow` · `rbac` · `roles` · `typescript`

**Auto permission generator** — lightweight RBAC-style policies with **role inheritance**, **`allow` lists**, and Express **route guards** so `403` handling stays consistent.

## Install

```bash
npm install @mr-aftab-ahmad-khan/policyflow express
```

## Example

```typescript
import express from "express";
import { policyflow } from "@mr-aftab-ahmad-khan/policyflow";

const policies = policyflow()
  .inherits("org-admin", "member")
  .inherits("member", "guest")
  .allowAction("guest", "billing.read")
  .allowAction("member", "billing.write")
  .allowAction("org-admin", "*");

const app = express();
const role = (req: express.Request) => (req as { user?: { role?: string } }).user?.role;

app.get("/billing", policies.require(role, "billing.read"), (_req, res) => res.send("ok"));
```

## License

MIT
