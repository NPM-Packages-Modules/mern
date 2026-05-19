# workflowmesh

**Smart async workflow engine** for Node.js: chain business steps with **retries**, simple **backoff**, and optional **rollback** so nested `try/catch` trees do not swallow your architecture.

## Install

```bash
npm install @mr-aftab-ahmad-khan/workflowmesh
```

## Example

```typescript
import { workflowMesh } from "@mr-aftab-ahmad-khan/workflowmesh";

type Ctx = { userId: string; invoiceId?: string };

const checkout = workflowMesh<Ctx>()
  .step({ name: "validate", run: async () => {} })
  .step({
    name: "charge",
    retry: 2,
    retryDelayMs: 200,
    run: async (ctx) => {
      /* call payment provider */
    },
    rollback: async () => {
      /* void payment attempt */
    },
  })
  .step({ name: "email", run: async () => {} });

await checkout.runWithRollback({ userId: "u1" });
```

## License

MIT
