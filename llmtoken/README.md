# llmtoken

[![npm version](https://img.shields.io/npm/v/llmtoken.svg)](https://www.npmjs.com/package/llmtoken)
[![bundle size](https://img.shields.io/bundlephobia/minzip/llmtoken)](https://bundlephobia.com/package/llmtoken)
[![license](https://img.shields.io/npm/l/llmtoken.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Stop writing SSE parsers.** `llmtoken` is a tiny, **zero-dependency**, fully tree-shakeable library that normalizes streaming responses from **OpenAI**, **Anthropic**, **Gemini**, **Groq**, **DeepSeek**, and **Ollama** into one clean `StreamChunk` async iterator — works in Node.js, the browser, Bun, Deno, and Cloudflare Workers.

Every multi-provider AI app re-solves this: the OpenAI SSE format vs Anthropic's `content_block_delta` vs Gemini's JSON array vs Ollama's NDJSON, tool calls split across chunks, reasoning tokens for o1/R1, finish reasons that don't match, mid-stream errors. `llmtoken` handles all of it under 5 KB minified and exposes a discriminated union you can pattern-match in TypeScript.

---

## Installation

```bash
npm install llmtoken
pnpm add llmtoken
yarn add llmtoken
```

Zero runtime dependencies.

---

## Quick Start

```ts
import { parseStream } from "llmtoken";

const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    stream: true,
    messages: [{ role: "user", content: "Say hi" }],
  }),
});

for await (const chunk of parseStream(res, { provider: "openai" })) {
  if (chunk.type === "text") process.stdout.write(chunk.delta);
}
```

---

## Core Usage Examples

### 1. OpenAI streaming text

```ts
import { parseStream } from "llmtoken";

const res = await fetch(/* OpenAI streaming endpoint */);
for await (const chunk of parseStream(res, { provider: "openai" })) {
  if (chunk.type === "text") process.stdout.write(chunk.delta);
}
```

### 2. Anthropic streaming with tool use

```ts
import { parseStream } from "llmtoken";

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({
    model: "claude-sonnet-4",
    max_tokens: 512,
    stream: true,
    tools: [{ name: "get_weather", description: "Get weather", input_schema: { type: "object", properties: {} } }],
    messages: [{ role: "user", content: "Weather in SF?" }],
  }),
});

for await (const chunk of parseStream(res, { provider: "anthropic" })) {
  if (chunk.type === "tool_call" && chunk.done) {
    console.log("call", chunk.name, JSON.parse(chunk.arguments));
  }
}
```

### 3. `collectStream` for the full assembled message

```ts
import { parseStream, collectStream } from "llmtoken";

const res = await fetch(/* ... */);
const message = await collectStream(parseStream(res, { provider: "openai" }));
console.log(message.text, message.usage);
```

### 4. `teeStream` to log AND display

```ts
import { parseStream, teeStream } from "llmtoken";

const [forUser, forLog] = teeStream(parseStream(res, { provider: "openai" }));

await Promise.all([
  (async () => {
    for await (const c of forUser) if (c.type === "text") process.stdout.write(c.delta);
  })(),
  (async () => {
    for await (const c of forLog) if (c.type === "done") console.log("usage:", c.usage);
  })(),
]);
```

### 5. DeepSeek R1 reasoning vs answer

```ts
import { parseStream } from "llmtoken";

for await (const chunk of parseStream(res, { provider: "deepseek" })) {
  if (chunk.type === "reasoning") process.stderr.write(chunk.delta);
  else if (chunk.type === "text") process.stdout.write(chunk.delta);
}
```

### 6. Auto-detect provider

```ts
import { parseStream, detectProvider } from "llmtoken";

const provider = detectProvider(res.headers) ?? "openai";
for await (const c of parseStream(res, { provider })) {
  if (c.type === "text") process.stdout.write(c.delta);
}
```

---

## Provider Integration Examples

### OpenAI

```ts
import OpenAI from "openai";
import { parseStream } from "llmtoken";

const openai = new OpenAI();
const res = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  stream: true,
  messages: [{ role: "user", content: "Hi" }],
}, { responseType: "stream" as never });

for await (const chunk of parseStream(res.toReadableStream(), { provider: "openai" })) {
  if (chunk.type === "text") process.stdout.write(chunk.delta);
}
```

### Anthropic

```ts
import Anthropic from "@anthropic-ai/sdk";
import { parseStream } from "llmtoken";

const anthropic = new Anthropic();
const res = await anthropic.messages.stream({
  model: "claude-sonnet-4",
  max_tokens: 256,
  messages: [{ role: "user", content: "Hi" }],
});
for await (const chunk of parseStream(res.toReadableStream(), { provider: "anthropic" })) {
  if (chunk.type === "text") process.stdout.write(chunk.delta);
}
```

### Gemini

```ts
import { parseStream } from "llmtoken";

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${process.env.GEMINI_KEY}`,
  { method: "POST", body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] }) },
);
for await (const c of parseStream(res, { provider: "gemini" })) {
  if (c.type === "text") process.stdout.write(c.delta);
}
```

### Groq

```ts
import { parseStream } from "llmtoken";

const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "llama-3.3-70b-versatile", stream: true, messages: [{ role: "user", content: "Hi" }] }),
});
for await (const c of parseStream(res, { provider: "groq" })) {
  if (c.type === "text") process.stdout.write(c.delta);
}
```

### DeepSeek

```ts
import { parseStream } from "llmtoken";

const res = await fetch("https://api.deepseek.com/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "deepseek-reasoner", stream: true, messages: [{ role: "user", content: "Hi" }] }),
});
for await (const c of parseStream(res, { provider: "deepseek" })) {
  if (c.type === "reasoning") process.stderr.write(c.delta);
  else if (c.type === "text") process.stdout.write(c.delta);
}
```

### Ollama

```ts
import { parseStream } from "llmtoken";

const res = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  body: JSON.stringify({ model: "llama3.1", stream: true, messages: [{ role: "user", content: "Hi" }] }),
});
for await (const c of parseStream(res, { provider: "ollama" })) {
  if (c.type === "text") process.stdout.write(c.delta);
}
```

---

## Configuration Reference

`parseStream(src, options)`:

| Option              | Type            | Default | Description                                |
| ------------------- | --------------- | ------- | ------------------------------------------ |
| `provider`          | `Provider`      | —       | One of: openai, anthropic, gemini, groq, deepseek, ollama |
| `defaultStopReason` | `string`        | varies  | Used if the provider never emits one       |

Accepted sources: `Response`, `ReadableStream<Uint8Array>`, `AsyncIterable<Uint8Array>`, or any `{ body: ReadableStream }`.

---

## Error Handling

`llmtoken` surfaces mid-stream errors as a chunk; the iterator may still emit a final `done` chunk afterwards if recoverable.

```ts
import { parseStream, StreamParseError } from "llmtoken";

try {
  for await (const c of parseStream(res, { provider: "openai" })) {
    if (c.type === "error") {
      console.error(c.code, c.message);
      break;
    }
    if (c.type === "text") process.stdout.write(c.delta);
  }
} catch (err) {
  if (err instanceof StreamParseError) console.error("fatal:", err.message);
}
```

---

## TypeScript Types

```ts
import type {
  StreamChunk,
  TextChunk,
  ToolCallChunk,
  DoneChunk,
  ReasoningChunk,
  ErrorChunk,
  ParseStreamOptions,
  CollectedMessage,
} from "llmtoken";

function handle(chunk: StreamChunk) {
  if (chunk.type === "text") {
    chunk.delta;     // string
    chunk.index;     // number
  } else if (chunk.type === "tool_call") {
    chunk.id;
    chunk.name;
    chunk.arguments; // string (JSON)
    chunk.done;
  } else if (chunk.type === "done") {
    chunk.usage.promptTokens;
    chunk.usage.completionTokens;
  }
}
```

---

## Bundle Size

| Module                   | gzip   |
| ------------------------ | ------ |
| `llmtoken` core        | < 1 KB |
| OpenAI / Groq / DeepSeek | ~1 KB  |
| Anthropic                | ~1 KB  |
| Gemini                   | ~1 KB  |
| Ollama                   | < 0.5 KB |
| **Full bundle**          | **< 5 KB gzipped** |

Import only the provider you need: `import { parseOpenAIStream } from "llmtoken/openai"`.

---

## Real-World Recipe — Multi-Provider Chat with Fallback

```ts
import { parseStream, type StreamChunk } from "llmtoken";

async function* chatWithFallback(prompt: string): AsyncIterable<StreamChunk> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", stream: true, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    yield* parseStream(res, { provider: "openai" });
  } catch {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4", stream: true, max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
    });
    yield* parseStream(res, { provider: "anthropic" });
  }
}

// Stream to the browser as SSE
import express from "express";
const app = express();
app.get("/chat", async (req, res) => {
  res.setHeader("content-type", "text/event-stream");
  for await (const c of chatWithFallback(String(req.query.q ?? ""))) {
    res.write(`data: ${JSON.stringify(c)}\n\n`);
  }
  res.end();
});
```

---

## SSE Format Reference

| Provider   | Framing                                             | Tool calls                                        | Done marker                |
| ---------- | --------------------------------------------------- | ------------------------------------------------- | -------------------------- |
| OpenAI     | `data: { choices:[{ delta }] }\n\n` then `data: [DONE]` | `delta.tool_calls[i]` delta-merged on `i.index`   | `[DONE]`                   |
| Anthropic  | `event: <t>\ndata: { ... }\n\n`                     | `content_block_start { type: "tool_use" }` + `input_json_delta` | `message_stop`             |
| Gemini     | JSON array streamed as bytes                        | `parts[i].functionCall { name, args }`            | finishReason on candidate  |
| Groq       | OpenAI-compatible                                   | Same as OpenAI                                    | `[DONE]`                   |
| DeepSeek   | OpenAI-compatible + `reasoning_content`             | Same as OpenAI                                    | `[DONE]`                   |
| Ollama     | NDJSON, one JSON object per line                    | `tool_calls` in final message (model dependent)   | `done: true`               |

All of them collapse to the same `StreamChunk` union, so your consumer code does not change.

---

## Comparison Table

| Feature                     | Manual SSE | Vercel AI SDK | **llmtoken** |
| --------------------------- | :--------: | :-----------: | :------------: |
| Bundle size                 |    DIY     |    ~30 KB     |   **< 5 KB**   |
| Zero deps                   |    ✅      |      ❌       |       ✅       |
| All 6 providers             |    ❌      |      ⚠️       |       ✅       |
| Tool call normalization     |    ❌      |      ✅       |       ✅       |
| Reasoning tokens            |    ❌      |      ⚠️       |       ✅       |
| Tree-shakeable per provider |    n/a     |      ❌       |       ✅       |
| Browser + Node.js + Workers |    DIY     |      ⚠️       |       ✅       |

---

## License

MIT
