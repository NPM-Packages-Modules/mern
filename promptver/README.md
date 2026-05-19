# promptver

**Topics:** `a-b-testing` · `ab-testing` · `ai` · `anthropic` · `cli` · `llm` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `openai` · `prompt` · `promptver` · `rollback` · `typescript` · `versioning`

[![npm version](https://img.shields.io/npm/v/promptver.svg)](https://www.npmjs.com/package/promptver)
[![bundle size](https://img.shields.io/bundlephobia/minzip/promptver)](https://bundlephobia.com/package/promptver)
[![license](https://img.shields.io/npm/l/promptver.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Treat your LLM prompts like database migrations.** `promptver` versions every prompt, lets you roll back instantly when v3 turns out to hallucinate, and runs deterministic A/B experiments across any LLM provider — OpenAI, Anthropic, Vercel AI SDK, or raw fetch.

Strings embedded in your codebase get edited without review, lose attribution, and silently break production. With `promptver` every prompt is a numbered, immutable file on disk (or any pluggable backend). Switching the active version is a one-line CLI call. Experiments record per-variant cost, latency, and any custom metric you care about, and `experiment.getWinner()` tells you which one to ship.

---

## Installation

```bash
npm install promptver zod
pnpm add promptver zod
yarn add promptver zod
```

---

## Quick Start

```ts
import { PromptForge } from "promptver";
import OpenAI from "openai";

const forge = new PromptForge();
await forge.init();
await forge.create("summarize", "Summarize this text in one sentence:\n\n{{text}}", {
  model: "gpt-4o-mini",
});

const openai = new OpenAI();
const rendered = await forge.render("summarize", { text: "Hello world" });
const res = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: rendered }],
});
```

---

## Core Usage Examples

### 1. Create and load a versioned prompt

```ts
import { PromptForge } from "promptver";

const forge = new PromptForge();
await forge.init();

await forge.create(
  "extract_emails",
  "Extract every email address from the text:\n\n{{text}}",
  { model: "gpt-4o-mini" },
);

const prompt = await forge.load("extract_emails");
console.log(prompt.version, prompt.template);
```

### 2. Render a template with variables

```ts
import { PromptForge } from "promptver";

const forge = new PromptForge();
const out = await forge.render("extract_emails", {
  text: "Contact a@b.com and c@d.com.",
});
console.log(out);
// Extract every email address from the text:
//
// Contact a@b.com and c@d.com.
```

### 3. Roll back to a previous version

```ts
import { PromptForge } from "promptver";

const forge = new PromptForge();
await forge.create("summarize", "Summarize: {{text}}");
await forge.create("summarize", "Summarize concisely as bullet points: {{text}}");

// v2 is hallucinating? Roll back.
await forge.rollback("summarize", 1);
console.log((await forge.load("summarize")).version); // 1
```

### 4. Set up an A/B experiment

```ts
import { PromptExperiment } from "promptver";

const experiment = new PromptExperiment({
  id: "summarize_2025_q1",
  variants: [
    { name: "A", promptName: "summarize", version: 1, weight: 70 },
    { name: "B", promptName: "summarize", version: 2, weight: 30 },
  ],
});

const variant = experiment.assign("user_123");
console.log(variant.name); // deterministic: same user => same variant
```

### 5. Read experiment results

```ts
experiment.record({
  variantName: "A",
  latencyMs: 420,
  costUsd: 0.0024,
  inputTokens: 312,
  outputTokens: 88,
});
experiment.record({
  variantName: "B",
  latencyMs: 510,
  costUsd: 0.0018,
  inputTokens: 312,
  outputTokens: 60,
});

console.log(experiment.getResult().byVariant);
console.log(experiment.getWinner("cost").name); // "B"
```

### 6. Wrap an OpenAI client

```ts
import OpenAI from "openai";
import { PromptForge, wrapProvider } from "promptver";

const forge = new PromptForge();
const openai = wrapProvider(new OpenAI(), forge, { provider: "openai" });

await openai.chat.completions.create({
  promptName: "summarize",
  variables: { text: "Hello world" },
} as unknown as Parameters<OpenAI["chat"]["completions"]["create"]>[0]);
```

---

## Framework Integration Examples

### OpenAI SDK

```ts
import OpenAI from "openai";
import { PromptForge, wrapProvider } from "promptver";

const forge = new PromptForge();
await forge.create("answer", "Answer briefly: {{question}}", { model: "gpt-4o-mini" });

const openai = wrapProvider(new OpenAI(), forge, { provider: "openai" });
const res = await openai.chat.completions.create({
  promptName: "answer",
  variables: { question: "What is 2 + 2?" },
} as any);
```

### Anthropic SDK

```ts
import Anthropic from "@anthropic-ai/sdk";
import { PromptForge, wrapProvider } from "promptver";

const forge = new PromptForge();
await forge.create("translate", "Translate to French: {{text}}", { model: "claude-sonnet-4" });

const anthropic = wrapProvider(new Anthropic(), forge, { provider: "anthropic" });
await anthropic.messages.create({
  max_tokens: 1024,
  promptName: "translate",
  variables: { text: "Hello" },
} as any);
```

### Vercel AI SDK

```ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { PromptForge, buildRequest } from "promptver";

const forge = new PromptForge();
const built = await buildRequest(forge, "summarize", { text: "Long input here" });

const result = streamText({
  model: openai(built.model ?? "gpt-4o-mini"),
  prompt: built.rendered,
});

for await (const chunk of result.textStream) process.stdout.write(chunk);
```

### Next.js API route

```ts
// app/api/summarize/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PromptForge, wrapProvider } from "promptver";

const forge = new PromptForge();
const openai = wrapProvider(new OpenAI(), forge, { provider: "openai" });

export async function POST(req: Request) {
  const { text } = await req.json();
  const res = await openai.chat.completions.create({
    promptName: "summarize",
    variables: { text },
  } as any);
  return NextResponse.json(res);
}
```

---

## Configuration Reference

### `new PromptForge(options)`

| Option    | Type             | Default          | Description                       |
| --------- | ---------------- | ---------------- | --------------------------------- |
| `storage` | `StorageAdapter` | `new FileStorage()` | Backend for prompt persistence |

### `new PromptExperiment(config)`

| Field      | Type                  | Description                                      |
| ---------- | --------------------- | ------------------------------------------------ |
| `id`       | `string`              | Stable identifier (used to seed assignment hash) |
| `variants` | `ExperimentVariant[]` | Each with `name`, `promptName`, `version?`, `weight` |

### `new FileStorage(options)`

| Option | Type     | Default     | Description                |
| ------ | -------- | ----------- | -------------------------- |
| `dir`  | `string` | `"prompts"` | Directory for prompt files |

### `wrapProvider(client, forge, options)`

| Option       | Type                     | Default | Description                                    |
| ------------ | ------------------------ | ------- | ---------------------------------------------- |
| `provider`   | `"openai" \| "anthropic"`| —       | Wire shape used to inject messages             |
| `applyModel` | `boolean`                | `true`  | Override request `model` with the prompt's model |

---

## Error Handling

```ts
import { PromptForge, PromptNotFoundError, VersionConflictError, StorageError } from "promptver";

try {
  await new PromptForge().load("does_not_exist");
} catch (err) {
  if (err instanceof PromptNotFoundError) {
    console.error(err.promptName, err.version);
  } else if (err instanceof VersionConflictError) {
    console.error("dup version", err.version);
  } else if (err instanceof StorageError) {
    console.error("storage failed", err.cause);
  }
}
```

---

## TypeScript Types

```ts
import type {
  PromptDefinition,
  ExperimentConfig,
  ExperimentResult,
  ExperimentVariant,
  StorageAdapter,
  CallRecord,
} from "promptver";

class PostgresStorage implements StorageAdapter {
  async loadRegistry() { /* ... */ return { version: 1 as const, prompts: {} }; }
  async saveRegistry() {}
  async loadPrompt() { throw new Error("not yet"); }
  async savePrompt() {}
  async listPrompts() { return []; }
  async listVersions() { return []; }
}
```

---

## CLI Reference

```bash
promptver init
promptver create summarize --template "Summarize: {{text}}" --model gpt-4o-mini
promptver rollback summarize 1
promptver list
```

| Command                   | Flags                                              | Description                                  |
| ------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `init`                    | `-d, --dir <path>`                                 | Create the prompts directory                 |
| `create <name>`           | `-t, --template <text>`, `-m, --model <model>`     | Create a new version of a prompt             |
| `rollback <name> <ver>`   |                                                    | Mark a previous version as active            |
| `list`                    |                                                    | Print every prompt with its active version   |

Sample output of `promptver list`:

```
summarize	active=v1	versions=[1, 2]
extract_emails	active=v2	versions=[1, 2]
```

---

## Real-World Recipe — Multi-Variant Summarization Service

```ts
// scripts/seed.ts
import { PromptForge } from "promptver";

const forge = new PromptForge();
await forge.init();
await forge.create("summarize", "Summarize: {{text}}", { model: "gpt-4o-mini" });
await forge.create("summarize", "Summarize the following as 3-5 bullet points:\n\n{{text}}", { model: "gpt-4o-mini" });
```

```ts
// src/experiment.ts
import { PromptExperiment } from "promptver";

export const summarizationExperiment = new PromptExperiment({
  id: "summarize_2025_q1",
  variants: [
    { name: "v1_paragraph", promptName: "summarize", version: 1, weight: 50 },
    { name: "v2_bullets", promptName: "summarize", version: 2, weight: 50 },
  ],
});
```

```ts
// src/server.ts
import express from "express";
import OpenAI from "openai";
import { PromptForge, buildRequest } from "promptver";
import { summarizationExperiment } from "./experiment.js";

const app = express();
app.use(express.json());

const forge = new PromptForge();
const openai = new OpenAI();

app.post("/summarize", async (req, res) => {
  const { userId, text } = req.body as { userId: string; text: string };
  const variant = summarizationExperiment.assign(userId);
  const built = await buildRequest(forge, variant.promptName, { text }, variant.version);

  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model: built.model ?? "gpt-4o-mini",
    messages: [{ role: "user", content: built.rendered }],
  });
  const latencyMs = Date.now() - start;

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const costUsd = (inputTokens * 0.15 + outputTokens * 0.60) / 1_000_000;

  summarizationExperiment.record({
    variantName: variant.name,
    latencyMs,
    costUsd,
    inputTokens,
    outputTokens,
  });

  res.json({ variant: variant.name, summary: completion.choices[0]?.message?.content });
});

app.get("/results", (_req, res) => {
  res.json({
    result: summarizationExperiment.getResult(),
    winner_by_cost: summarizationExperiment.getWinner("cost").name,
  });
});

app.listen(3000);
```

```bash
# Discovered v2 is more expensive — roll back
promptver rollback summarize 1
```

---

## Prompt File Format Reference

`prompts/<name>/<version>.json`:

```json
{
  "id": "summarize",
  "version": 2,
  "template": "Summarize the following as 3-5 bullet points:\n\n{{text}}",
  "variables": ["text"],
  "model": "gpt-4o-mini",
  "metadata": {
    "author": "@ada",
    "createdAt": "2026-01-12T09:32:11.000Z"
  }
}
```

| Field        | Type     | Description                                          |
| ------------ | -------- | ---------------------------------------------------- |
| `id`         | `string` | Prompt name (== folder name)                         |
| `version`    | `number` | Monotonically increasing integer                     |
| `template`   | `string` | Mustache-style `{{variable}}` template (dot notation supported) |
| `variables`  | `string[]` | Auto-extracted from template unless provided        |
| `model`      | `string?`| Optional default model                               |
| `metadata`   | `object` | Free-form annotations                                |

Registry `prompts/_registry.json`:

```json
{
  "version": 1,
  "prompts": {
    "summarize": { "name": "summarize", "activeVersion": 1, "versions": [1, 2] }
  }
}
```

---

## Comparison Table

| Feature           | Hardcoded strings | LangChain hub | **promptver** |
| ----------------- | :---------------: | :-----------: | :--------------: |
| Versioning        |        ❌         |       ✅      |        ✅        |
| Rollback          |        ❌         |       ✅      |        ✅        |
| A/B testing       |        ❌         |       ❌      |        ✅        |
| Provider agnostic |        ✅         |       ❌      |        ✅        |
| Self-hosted       |        ✅         |       ❌      |        ✅        |
| TypeScript types  |        ⚠️         |       ⚠️      |        ✅        |
| CLI tooling       |        ❌         |       ❌      |        ✅        |

---

## License

MIT
