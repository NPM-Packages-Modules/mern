# envguard

Production-safe environment validation for Node.js. Define a schema once, get fully-typed env vars, CI-friendly checks, and a CLI that fails the build before a missing secret reaches production.

## Why

Broken `.env` setups crash deployments. `envguard` validates required vars, types, and constraints at boot — and in CI — so misconfiguration never reaches users.

## Install

```bash
npm install @mr-aftab-ahmad-khan/envguard
```

## Quick start

```ts
import { envguard, e } from "@mr-aftab-ahmad-khan/envguard";

export const env = envguard({
  NODE_ENV: e.enums({ values: ["development", "production", "test"] as const }),
  PORT: e.port({ default: 3000 }),
  DATABASE_URL: e.url({ protocols: ["postgres", "postgresql", "mongodb"] }),
  REDIS_URL: e.url({ required: false }),
  JWT_SECRET: e.string({ min: 32, secret: true }),
  RATE_LIMIT: e.number({ default: 100, integer: true, min: 1 }),
  ENABLE_BETA: e.boolean({ default: false }),
  ADMIN_EMAIL: e.email(),
});

console.log(`Booting on port ${env.PORT}`);
```

If any var is missing or invalid, `envguard` throws a clear, aggregated `EnvValidationError` listing every problem at once.

## Available rules

| Rule | Options |
| --- | --- |
| `e.string` | `min`, `max`, `pattern`, `default`, `required`, `secret` |
| `e.number` | `min`, `max`, `integer`, `default`, `required` |
| `e.boolean` | `default`, `required` (accepts `true/false/1/0/yes/no/on/off`) |
| `e.url` | `protocols`, `default`, `required` |
| `e.email` | inherits string options |
| `e.enums` | `values` (required const array), `default`, `required` |
| `e.json` | parses JSON, generic typed |
| `e.port` | integer in `1..65535` |

## CLI

Validate before deploy:

```bash
npx @mr-aftab-ahmad-khan/envguard check --schema ./env.schema.ts --env .env.production
```

Explain a schema for docs:

```bash
npx @mr-aftab-ahmad-khan/envguard explain --schema ./env.schema.ts
```

Your schema file must `export default` (or `export const schema =`) the schema object.

## Non-throwing API

```ts
import { guard, e } from "@mr-aftab-ahmad-khan/envguard";

const { ok, data, issues } = guard.validate(
  { PORT: e.port() },
  { source: process.env },
);
```

Useful in tests or when you want to render a friendly health-check report instead of crashing.

## Loading from `.env`

```ts
import { loadDotEnv, mergeSources, validate, e } from "@mr-aftab-ahmad-khan/envguard";

const source = mergeSources(
  loadDotEnv(".env"),
  loadDotEnv(`.env.${process.env.NODE_ENV}`),
  process.env as Record<string, string | undefined>,
);

const result = validate({ PORT: e.port() }, { source });
```

## License

MIT
