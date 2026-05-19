# formbridge

**Topics:** `api` · `form` · `formbridge` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `react` · `schema` · `typescript` · `validation` · `zod`

**Smart form-to-backend connector** — keep a single **Zod** schema for client forms and API bodies, and map validation errors to **field keys** both ways.

## Install

```bash
npm install @mr-aftab-ahmad-khan/formbridge zod
```

## Example

```typescript
import { z } from "zod";
import { formbridge } from "@mr-aftab-ahmad-khan/formbridge";

const signup = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const bridge = formbridge(signup);

const onSubmitState = bridge.validate(formState);
if (!onSubmitState.success) {
  setFieldErrors(onSubmitState.fieldErrors);
  return;
}

await fetch("/api/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(onSubmitState.data),
});
```

## License

MIT
