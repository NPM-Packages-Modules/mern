# rulemesh

**Topics:** `automation` · `events` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `rulemesh` · `rules` · `typescript` · `workflow`

**Background automation rules engine** — register **`when(event, handler, match?)`** listeners and **`emit`** domain events from your services without hard-coding gigantic `switch` trees.

## Install

```bash
npm install @mr-aftab-ahmad-khan/rulemesh
```

## Example

```typescript
import { ruleMesh } from "@mr-aftab-ahmad-khan/rulemesh";

type Ctx = { userId: string; email: string; plan: string };

const rules = ruleMesh<Ctx>();

rules.when("user.created", async (ctx) => {
  await sendWelcomeEmail(ctx.email);
});

rules.when(
  "user.created",
  async (ctx) => {
    await startTrial(ctx.userId);
  },
  (ctx) => ctx.plan === "pro"
);

await rules.emit("user.created", { userId: "u1", email: "a@b.co", plan: "free" });
```

## License

MIT
