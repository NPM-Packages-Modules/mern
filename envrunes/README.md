# envrunes

**Topics:** `astro` · `cli` · `config` · `dotenv` · `env` · `environment` · `envrunes` · `mern-packages` · `merndev` · `next` · `nextjs` · `nodejs` · `npm-pm` · `observability` · `schema` · `type-safe` · `typescript` · `validation` · `vite` · `zod`

[![npm version](https://img.shields.io/npm/v/envrunes.svg)](https://www.npmjs.com/package/envrunes)
[![bundle size](https://img.shields.io/bundlephobia/minzip/envrunes)](https://bundlephobia.com/package/envrunes)
[![license](https://img.shields.io/npm/l/envrunes.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Type-safe environment variables for any JavaScript runtime.** `envrunes` is a framework-agnostic, Zod-powered loader that turns `process.env` into a strongly-typed, validated object at boot. `env.PORT` is a `number`. `env.DATABASE_URL` is a non-empty URL string. Defaults flow into the inferred type. Missing or malformed variables are reported all-at-once before your app starts.

Unlike `dotenv` (which gives you `string | undefined` everywhere) or `t3-env` (which is glued to Next.js + React), `envrunes` is a tiny zero-runtime-dependency core with optional adapters for **Next.js**, **Vite**, and **Astro**, a CLI for CI validation and `.env.example` generation, and a strict server/client boundary that throws at runtime if you ever try to read a secret in the browser.

---

## Installation

```bash
npm install envrunes zod
# or
pnpm add envrunes zod
# or
yarn add envrunes zod
```

`zod` is a peer dependency — `envrunes` itself has no runtime dependencies.

---

## Quick Start

```ts
import { createEnv } from "envrunes";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
  },
});

console.log(env.DATABASE_URL); // string
console.log(env.PORT);         // number
```

If `DATABASE_URL` is missing, the process exits with a clear error listing every problem at once.

---

## Core Usage Examples

### 1. Basic server-only env

```ts
import { createEnv } from "envrunes";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number(),
    DEBUG: z.coerce.boolean(),
    API_BASE: z.string().url(),
  },
});

env.DATABASE_URL; // string
env.PORT;         // number
env.DEBUG;        // boolean
env.API_BASE;     // string
```

### 2. Defaults and coercion

```ts
import { createEnv } from "envrunes";
import { z } from "zod";

export const env = createEnv({
  server: {
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    FEATURE_X_ENABLED: z.coerce.boolean().default(false),
  },
});

env.PORT;              // number (3000 if PORT is missing)
env.LOG_LEVEL;         // "debug" | "info" | "warn" | "error"
env.FEATURE_X_ENABLED; // boolean
```

### 3. Custom onValidationError hook

```ts
import { createEnv, EnvValidationError } from "envrunes";
import { z } from "zod";

export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  onValidationError: (err: EnvValidationError) => {
    console.error("envrunes: cannot start, missing required env");
    for (const v of err.invalid) {
      console.error(`  - ${v.name}`);
    }
    process.exit(1);
  },
});
```

### 4. skipValidation in Vitest setup

```ts
// vitest.setup.ts
import { beforeAll } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.SKIP_ENV_VALIDATION = "1";
});

// src/env.ts
import { createEnv } from "envrunes";
import { z } from "zod";

export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

### 5. Shared env in a utility module

```ts
// src/env.ts
import { createEnv } from "envrunes/next";
import { z } from "zod";

export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  client: { NEXT_PUBLIC_APP_URL: z.string().url() },
});

// src/lib/api.ts (imported by both server and client code)
import { env } from "../env";

export function getApiBase() {
  return env.NEXT_PUBLIC_APP_URL; // safe everywhere
}
```

### 6. Combining multiple env files via runtimeEnv

```ts
import { createEnv } from "envrunes";
import { z } from "zod";

const stage = process.env.NODE_ENV ?? "development";
const overlay = stage === "production" ? process.env : { ...process.env, DEBUG: "true" };

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DEBUG: z.coerce.boolean().default(false),
  },
  runtimeEnv: overlay,
});
```

---

## Framework Integration Examples

### Next.js App Router

```ts
// src/env.ts
import { createEnv } from "envrunes/next";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  },
});
```

```tsx
// app/page.tsx (Server Component)
import { env } from "@/env";

export default function Page() {
  const url = process.env.NODE_ENV === "production"
    ? env.NEXT_PUBLIC_APP_URL
    : "http://localhost:3000";
  return <main>{url}</main>;
}
```

```tsx
// app/components/StripeButton.tsx
"use client";
import { env } from "@/env";

export function StripeButton() {
  return <button data-key={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}>Pay</button>;
}
```

### Vite + React

```ts
// src/env.ts
import { createEnv } from "envrunes/vite";
import { z } from "zod";

export const env = createEnv({
  client: {
    VITE_API_BASE: z.string().url(),
    VITE_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: import.meta.env,
});
```

```tsx
// src/App.tsx
import { env } from "./env";

export function App() {
  return <pre>{env.VITE_API_BASE}</pre>;
}
```

### Plain Express

```ts
// src/env.ts
import { createEnv } from "envrunes";
import { z } from "zod";

export const env = createEnv({
  server: {
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
  },
});

// src/server.ts
import express from "express";
import { env } from "./env";

const app = express();
app.listen(env.PORT, () => console.log(`listening on ${env.PORT}`));
```

---

## Configuration Reference

| Option                   | Type                                   | Default            | Description                                                                 |
| ------------------------ | -------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `server`                 | `Record<string, ZodTypeAny>`           | `{}`               | Server-only schemas. Never accessible on the client.                        |
| `client`                 | `Record<string, ZodTypeAny>`           | `{}`               | Client-exposed schemas. Must match `clientPrefix` (when set by an adapter). |
| `runtimeEnv`             | `Record<string, string \| undefined>`  | `process.env`      | Source of raw values.                                                       |
| `clientPrefix`           | `string`                               | `undefined`        | Prefix required on every `client` key. Set by adapters.                     |
| `skipValidation`         | `boolean`                              | `false`            | Bypass Zod parsing; values returned as-is.                                  |
| `onValidationError`      | `(err: EnvValidationError) => void`    | `undefined`        | Called instead of throwing.                                                 |
| `isServer`               | `boolean`                              | `typeof window === "undefined"` | Controls whether server vars can be read.                  |
| `emptyStringAsUndefined` | `boolean`                              | `true`             | Coerce `""` to `undefined` so defaults fire.                                |

---

## Error Handling

When validation fails, `envrunes` throws an `EnvValidationError`:

```
Invalid environment variables (2 issues):
  - DATABASE_URL: Invalid url (received: "not-a-url")
  - PORT: Expected number, received string (received: "abc")
```

Catch it programmatically:

```ts
import { createEnv, EnvValidationError } from "envrunes";

try {
  const env = createEnv({ /* ... */ });
} catch (err) {
  if (err instanceof EnvValidationError) {
    for (const v of err.invalid) {
      console.error(v.name, v.received, v.issues);
    }
  }
  process.exit(1);
}
```

`EnvValidationError` shape:

```ts
class EnvValidationError extends Error {
  readonly invalid: ReadonlyArray<{
    name: string;
    received: unknown;
    issues: ReadonlyArray<ZodIssue>;
  }>;
}
```

---

## TypeScript Types

```ts
import type {
  CreateEnvOptions,
  Env,
  InferEnv,
  InvalidVar,
  ZodRecord,
} from "envrunes";

const env = createEnv({ server: { PORT: z.coerce.number() } });

type MyEnv = InferEnv<typeof env>;
// { readonly PORT: number }
```

---

## CLI Reference

### `envrunes validate`

Validates the current environment against your schema. Exits with code `1` on failure — perfect for CI.

```bash
envrunes validate
envrunes validate --schema src/env.ts --env .env.production
```

| Flag           | Default     | Description                                |
| -------------- | ----------- | ------------------------------------------ |
| `--schema, -s` | `src/env.ts`| Path to schema module (must export `schema = { server, client }`) |
| `--env, -e`    | `.env`      | Path to `.env` file                        |

### `envrunes generate-example`

Generates a `.env.example` from the schema, using `.default()` values or sensible placeholders.

```bash
envrunes generate-example
envrunes generate-example --out .env.example.local
```

| Flag        | Default        | Description                |
| ----------- | -------------- | -------------------------- |
| `--out, -o` | `.env.example` | Output path                |

Schemas must be exported as:

```ts
// src/env.ts
import { z } from "zod";

export const schema = {
  server: { DATABASE_URL: z.string().url() },
  client: { NEXT_PUBLIC_URL: z.string().url() },
};
```

---

## Real-World Recipe — Full Next.js Production Setup

```ts
// src/env.ts
import { createEnv } from "envrunes/next";
import { z } from "zod";

export const schema = {
  server: {
    DATABASE_URL: z.string().url().describe("postgres://..."),
    NEXTAUTH_SECRET: z.string().min(32),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  },
};

export const env = createEnv(schema);
```

```bash
# .env.local
DATABASE_URL=postgres://app:pass@localhost:5432/app
NEXTAUTH_SECRET=ab92e7da6c0f4d39b1c6a8a2f0b1c4e3
STRIPE_SECRET_KEY=sk_test_abc123
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_abc123
```

```bash
# .env.example  (generated by `envrunes generate-example`)
# --- server-only ---
DATABASE_URL=postgres://...
NEXTAUTH_SECRET=your-value-here
STRIPE_SECRET_KEY=your-value-here

# --- exposed to client ---
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-value-here
```

```json
// package.json
{
  "scripts": {
    "build": "envrunes validate && next build",
    "start": "next start"
  }
}
```

```tsx
// app/page.tsx (Server Component)
import { env } from "@/env";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export default async function Page() {
  const balance = await stripe.balance.retrieve();
  return <pre>{JSON.stringify(balance, null, 2)}</pre>;
}
```

```tsx
// app/checkout/CheckoutButton.tsx
"use client";
import { env } from "@/env";

export function CheckoutButton() {
  return <button data-pk={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}>Pay</button>;
}
```

```yaml
# .github/workflows/deploy.yml
name: deploy
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx envrunes validate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
      - run: npm run build
```

---

## Migration Guide from dotenv

**Before — `dotenv`:**

```ts
import "dotenv/config";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL missing");

app.listen(port);
```

**After — `envrunes`:**

```ts
import { createEnv } from "envrunes";
import { z } from "zod";

const env = createEnv({
  server: {
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
  },
});

app.listen(env.PORT);
```

- `process.env.PORT` (`string | undefined`) → `env.PORT` (`number`).
- Missing `DATABASE_URL` fails before listen with every error printed at once.

---

## Comparison Table

| Feature                 | dotenv | t3-env | **envrunes** |
| ----------------------- | :----: | :----: | :------: |
| TypeScript types        |   ❌   |   ✅   |    ✅    |
| Framework agnostic      |   ✅   |   ❌   |    ✅    |
| Zod validation          |   ❌   |   ✅   |    ✅    |
| CLI tooling             |   ❌   |   ❌   |    ✅    |
| Client/server boundary  |   ❌   |   ✅   |    ✅    |
| Bundle size             | 6 KB   | 14 KB  |  **3 KB** |
| Custom error handler    |   ❌   |   ❌   |    ✅    |

---

## License

MIT
