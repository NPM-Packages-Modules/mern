# schemaui

**Smart validation-to-form generator** — given a **`z.object`** schema, build a minimal **React** form (text / number / checkbox / select) and surface **field errors** in one component.

## Install

```bash
npm install @mr-aftab-ahmad-khan/schemaui zod react
```

## Example

```tsx
import { useState } from "react";
import { z } from "zod";
import { SchemauiForm } from "@mr-aftab-ahmad-khan/schemaui";

const userSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().min(0),
  plan: z.enum(["free", "pro"]),
});

export function UserForm() {
  const [value, setValue] = useState<Record<string, unknown>>({ plan: "free" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  return (
    <SchemauiForm
      schema={userSchema}
      value={value}
      onChange={setValue}
      errors={errors}
    />
  );
}
```

Pair with **`@mr-aftab-ahmad-khan/formbridge`** on submit to keep client/server validation aligned.

## License

MIT
