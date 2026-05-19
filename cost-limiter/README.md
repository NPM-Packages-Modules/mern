# cost-limiter

[![npm version](https://img.shields.io/npm/v/cost-limiter.svg)](https://www.npmjs.com/package/cost-limiter)
[![bundle size](https://img.shields.io/bundlephobia/minzip/cost-limiter)](https://bundlephobia.com/package/cost-limiter)
[![license](https://img.shields.io/npm/l/cost-limiter.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Your LLM API bill is not a rate-limit problem — it's a cost problem.** `cost-limiter` wraps OpenAI, Anthropic, and other LLM clients with **dollar budgets** per user, per team, per API key, and globally. Built-in pricing tables for every current model, multiple time windows, soft warnings at 80%, hard limits with proper `429 Retry-After` data, and a pluggable storage backend so Redis-backed limits work across N app servers.

---

## Installation

```bash
npm install cost-limiter
pnpm add cost-limiter
yarn add cost-limiter
# Optional:
npm install ioredis  # for distributed enforcement
```

---

## Quick Start

```ts
import OpenAI from "openai";
import { CostLimiter } from "cost-limiter";

const limiter = new CostLimiter({
  budgets: { perUser: { day: 0.50, month: 5.00 } },
});

const openai = limiter.wrap(new OpenAI());
await openai.chat.completions.create({
  userId: "usr_123",
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hi" }],
} as any);
```

---

## Core Usage Examples

### 1. Per-user daily and monthly budgets (OpenAI)

```ts
import OpenAI from "openai";
import { CostLimiter } from "cost-limiter";

const limiter = new CostLimiter({
  budgets: { perUser: { day: 1.00, month: 25.00 } },
});
const openai = limiter.wrap(new OpenAI());
```

### 2. Per-team budget (Anthropic)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { CostLimiter } from "cost-limiter";

const limiter = new CostLimiter({
  budgets: { perTeam: { day: 50, month: 500 } },
});
const anthropic = limiter.wrapAnthropic(new Anthropic());

await anthropic.messages.create({
  teamId: "team_abc",
  model: "claude-sonnet-4",
  max_tokens: 200,
  messages: [{ role: "user", content: "Hi" }],
} as any);
```

### 3. Listen to BudgetWarning at 80%

```ts
limiter.on("BudgetWarning", (e) => {
  console.warn(`User ${e.key} is at ${(e.percent * 100).toFixed(1)}% of ${e.window} budget`);
});
```

### 4. Return 429 on CostLimitError

```ts
import { CostLimitError } from "cost-limiter";

app.post("/chat", async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({ userId: req.user.id, ...req.body });
    res.json(completion);
  } catch (err) {
    if (err instanceof CostLimitError) {
      const seconds = Math.ceil((err.resetAt.getTime() - Date.now()) / 1000);
      res.setHeader("Retry-After", seconds);
      return res.status(429).json({ error: err.message, resetAt: err.resetAt });
    }
    throw err;
  }
});
```

### 5. Usage report for a dashboard

```ts
const report = await limiter.getUsage("usr_123");
// { dimension: "user", key: "usr_123", spend: { day: 0.42, month: 1.83, ... }, limit: { day: 1, ... } }
```

### 6. Memory in dev, Redis in prod

```ts
import Redis from "ioredis";
import { CostLimiter, MemoryCostStorage, RedisCostStorage } from "cost-limiter";

const storage = process.env.NODE_ENV === "production"
  ? new RedisCostStorage(new Redis(process.env.REDIS_URL!))
  : new MemoryCostStorage();

const limiter = new CostLimiter({ storage, budgets: { perUser: { day: 1 } } });
```

---

## Framework Integration Examples

### Express middleware

```ts
import express from "express";
import { CostLimiter, CostLimitError } from "cost-limiter";

const limiter = new CostLimiter({ budgets: { perUser: { day: 1 } } });
const app = express();
app.use(
  limiter.middleware((req: any) => ({
    userId: req.user?.id,
    estimatedCostUsd: 0.0001,
  })),
);
```

### Hono middleware

```ts
import { Hono } from "hono";
import { CostLimiter, CostLimitError } from "cost-limiter";

const limiter = new CostLimiter({ budgets: { perUser: { day: 1 } } });
const app = new Hono();
app.use("*", async (c, next) => {
  try {
    await limiter.check({ userId: c.req.header("x-user-id") ?? "anon", provider: "openai", model: "gpt-4o-mini", inputTokens: 0 });
    await next();
  } catch (err) {
    if (err instanceof CostLimitError) {
      return c.json({ error: err.message }, 429, { "Retry-After": String(Math.ceil((err.resetAt.getTime() - Date.now()) / 1000)) });
    }
    throw err;
  }
});
```

### Next.js App Router

```ts
// app/api/chat/route.ts
import OpenAI from "openai";
import { CostLimiter, CostLimitError } from "cost-limiter";
import { NextResponse } from "next/server";

const limiter = new CostLimiter({ budgets: { perUser: { day: 1 } } });
const openai = limiter.wrap(new OpenAI());

export async function POST(req: Request) {
  const { userId, ...body } = await req.json();
  try {
    const completion = await openai.chat.completions.create({ userId, ...body } as any);
    return NextResponse.json(completion);
  } catch (err) {
    if (err instanceof CostLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429, headers: { "Retry-After": String(Math.ceil((err.resetAt.getTime() - Date.now()) / 1000)) } });
    }
    throw err;
  }
}
```

### tRPC procedure middleware

```ts
import { initTRPC, TRPCError } from "@trpc/server";
import { CostLimiter, CostLimitError } from "cost-limiter";

const limiter = new CostLimiter({ budgets: { perUser: { day: 1 } } });
const t = initTRPC.create();

const withBudget = t.middleware(async ({ ctx, next }) => {
  try {
    await limiter.check({ userId: (ctx as { userId: string }).userId, provider: "openai", model: "gpt-4o-mini", inputTokens: 0, estimatedCostUsd: 0.001 });
  } catch (err) {
    if (err instanceof CostLimitError) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: err.message });
    throw err;
  }
  return next();
});
```

---

## Configuration Reference

### `new CostLimiter(options)`

| Option         | Type                  | Default                | Description                                |
| -------------- | --------------------- | ---------------------- | ------------------------------------------ |
| `budgets`      | `BudgetConfig`        | `{}`                   | Per-dimension/window budgets in USD        |
| `storage`      | `StorageAdapter`      | `new MemoryCostStorage()` | Where to persist counters               |
| `pricing`      | `"auto" \| Record<...>`| `"auto"`              | Pricing table (override or extend)         |
| `warnThreshold`| `number`              | `0.8`                  | Emit `BudgetWarning` at this fraction      |

### `BudgetConfig`

```ts
interface BudgetConfig {
  perUser?:   { minute?: number; hour?: number; day?: number; month?: number };
  perTeam?:   { minute?: number; hour?: number; day?: number; month?: number };
  perApiKey?: { minute?: number; hour?: number; day?: number; month?: number };
  global?:    { minute?: number; hour?: number; day?: number; month?: number };
}
```

### `RedisCostStorage(redisClient, prefix?)`

| Option          | Type        | Default          | Description                  |
| --------------- | ----------- | ---------------- | ---------------------------- |
| `redis`         | `RedisLike` | —                | `ioredis` client (or compat) |
| `prefix`        | `string`    | `"cost-limiter"` | Key namespace                |

### `wrap(client, ctx?)` options

| Option        | Type      | Default | Description                       |
| ------------- | --------- | ------- | --------------------------------- |
| `ctx.provider`| `"openai"`| `"openai"` | Wire shape used for usage extraction |

---

## Pricing Reference

| Model               | Input $/1M | Output $/1M |
| ------------------- | ---------: | ----------: |
| `gpt-4o`            |       2.50 |       10.00 |
| `gpt-4o-mini`       |       0.15 |        0.60 |
| `gpt-4-turbo`       |      10.00 |       30.00 |
| `gpt-3.5-turbo`     |       0.50 |        1.50 |
| `o1`                |      15.00 |       60.00 |
| `o1-mini`           |       3.00 |       12.00 |
| `o3-mini`           |       1.10 |        4.40 |
| `claude-opus-4`     |      15.00 |       75.00 |
| `claude-sonnet-4`   |       3.00 |       15.00 |
| `claude-haiku-4`    |       1.00 |        5.00 |
| `gemini-2.0-flash`  |       0.10 |        0.40 |
| `gemini-1.5-pro`    |       1.25 |        5.00 |
| `gemini-1.5-flash`  |      0.075 |        0.30 |
| `llama-3.3-70b`     |       0.59 |        0.79 |
| `mixtral-8x7b`      |       0.24 |        0.24 |

Override:

```ts
import { CostLimiter, DEFAULT_PRICING } from "cost-limiter";

const limiter = new CostLimiter({
  pricing: { ...DEFAULT_PRICING, "my-fine-tune": { inputPerMTokens: 0.5, outputPerMTokens: 2.0 } },
});
```

---

## Error Handling

```ts
class CostLimitError extends Error {
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly window: "minute" | "hour" | "day" | "month";
  readonly dimension: "user" | "team" | "apiKey" | "global";
  readonly dimensionKey: string;
}

interface BudgetWarningEvent {
  dimension: string;
  key: string;
  window: "minute" | "hour" | "day" | "month";
  used: number;
  limit: number;
  percent: number;
}
```

Proper 429 response:

```ts
catch (err) {
  if (err instanceof CostLimitError) {
    const secs = Math.ceil((err.resetAt.getTime() - Date.now()) / 1000);
    res.setHeader("Retry-After", secs);
    return res.status(429).json({ limit: err.limit, used: err.used, resetAt: err.resetAt });
  }
}
```

---

## TypeScript Types

```ts
import type {
  BudgetConfig,
  UsageReport,
  CostLimitError,
  BudgetWarningEvent,
  StorageAdapter,
  PricingConfig,
} from "cost-limiter";
```

Implement a custom adapter:

```ts
import type { StorageAdapter, Window } from "cost-limiter";

class PostgresStorage implements StorageAdapter {
  async increment(key: string, amount: number, _w: Window, resetAt: Date) {
    /* INSERT ... ON CONFLICT DO UPDATE */
    return 0;
  }
  async get(key: string, _w: Window) { return 0; }
  async reset(key: string) { /* DELETE */ }
}
```

---

## Real-World Recipe — Multi-Tenant SaaS LLM API

```ts
import express from "express";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import Redis from "ioredis";
import {
  CostLimiter,
  CostLimitError,
  RedisCostStorage,
} from "cost-limiter";

const tierBudgets: Record<string, { day: number; month: number }> = {
  free: { day: 0.10, month: 2.00 },
  pro:  { day: 1.00, month: 20.00 },
  team: { day: 10.00, month: 200.00 },
};

const storage = new RedisCostStorage(new Redis(process.env.REDIS_URL!));

function limiterFor(tier: keyof typeof tierBudgets) {
  return new CostLimiter({
    storage,
    budgets: tier === "team"
      ? { perTeam: tierBudgets.team }
      : { perUser: tierBudgets[tier] },
  });
}

const app = express();
app.use(express.json());

app.use((req: any, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  req.user = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; tier: string; teamId?: string };
  next();
});

app.post("/chat", async (req: any, res) => {
  const limiter = limiterFor(req.user.tier as keyof typeof tierBudgets);
  limiter.on("BudgetWarning", (e) => {
    fetch(process.env.WEBHOOK_URL!, {
      method: "POST",
      body: JSON.stringify({ at80: e }),
    });
  });
  const openai = limiter.wrap(new OpenAI());
  try {
    const completion = await openai.chat.completions.create({
      userId: req.user.userId,
      teamId: req.user.teamId,
      model: req.body.model ?? "gpt-4o-mini",
      messages: req.body.messages,
    } as any);
    res.json(completion);
  } catch (err) {
    if (err instanceof CostLimitError) {
      return res.status(429).json({ error: err.message, resetAt: err.resetAt });
    }
    throw err;
  }
});

app.get("/usage", async (req: any, res) => {
  const limiter = limiterFor(req.user.tier as keyof typeof tierBudgets);
  res.json(await limiter.getUsage(req.user.userId));
});

app.listen(3000);
```

---

## Storage Adapter Guide — Postgres

```ts
import { Pool } from "pg";
import type { StorageAdapter, Window } from "cost-limiter";

export class PostgresCostStorage implements StorageAdapter {
  constructor(private pool: Pool, private table = "cost_counters") {}

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        key TEXT NOT NULL,
        window TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL DEFAULT 0,
        reset_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (key, window)
      );
    `);
  }

  async increment(key: string, amount: number, window: Window, resetAt: Date): Promise<number> {
    const res = await this.pool.query<{ value: number }>(
      `INSERT INTO ${this.table} (key, window, value, reset_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key, window) DO UPDATE SET
         value = CASE
                   WHEN ${this.table}.reset_at <= NOW() THEN EXCLUDED.value
                   ELSE ${this.table}.value + EXCLUDED.value
                 END,
         reset_at = CASE
                      WHEN ${this.table}.reset_at <= NOW() THEN EXCLUDED.reset_at
                      ELSE ${this.table}.reset_at
                    END
       RETURNING value`,
      [key, window, amount, resetAt],
    );
    return Number(res.rows[0]!.value);
  }

  async get(key: string, window: Window): Promise<number> {
    const res = await this.pool.query<{ value: number }>(
      `SELECT value FROM ${this.table} WHERE key = $1 AND window = $2 AND reset_at > NOW()`,
      [key, window],
    );
    return res.rows[0] ? Number(res.rows[0].value) : 0;
  }

  async reset(key: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE key = $1`, [key]);
  }
}
```

---

## Comparison Table

| Feature                | express-rate-limit | bottleneck | **cost-limiter** |
| ---------------------- | :----------------: | :--------: | :--------------: |
| Token-based limiting   |         ⚠️         |     ⚠️     |        ✅        |
| Dollar budgets         |         ❌         |     ❌     |        ✅        |
| Per-user tracking      |         ✅         |     ✅     |        ✅        |
| Multi-window           |         ⚠️         |     ❌     |        ✅        |
| OpenAI/Anthropic wrap  |         ❌         |     ❌     |        ✅        |
| Redis backend          |         ✅         |     ✅     |        ✅        |
| TypeScript types       |         ⚠️         |     ⚠️     |        ✅        |

---

## License

MIT
