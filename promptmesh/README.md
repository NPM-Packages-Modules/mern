# promptmesh

Production-grade prompt infrastructure for any AI app. Versioning, variable rendering, caching, A/B experiments, fallbacks, and built-in analytics — all in one tiny, provider-agnostic library.

## Why

Most teams hardcode prompts as string literals in their codebase. The minute you ship to production you need:

- A way to roll out a new prompt safely
- A cache so identical questions don't double-bill you
- A fallback when OpenAI is down → switch to Anthropic
- Per-variant latency and hit-rate metrics

`promptmesh` is the minimum useful surface for all of that.

## Install

```bash
npm install @mr-aftab-ahmad-khan/promptmesh
```

## Quick start

```ts
import { createMesh } from "@mr-aftab-ahmad-khan/promptmesh";

const mesh = createMesh<string>({
  defaultProvider: async (prompt) => callOpenAI(prompt.messages),
});

mesh.register({
  name: "support-agent",
  version: "1.0.0",
  messages: [
    { role: "system", content: "You are a helpful support agent." },
    { role: "user", content: "Customer says: {{message}}\nReply politely." },
  ],
  metadata: { model: "gpt-4o-mini" },
});

const result = await mesh.run("support-agent", {
  variables: { message: "I lost my password" },
});

console.log(result.response, result.cached, result.durationMs);
```

## Versioning

Register multiple versions side-by-side, then select with `version:`:

```ts
mesh.register({ name: "p", version: "1.0.0", messages: [...] });
mesh.register({ name: "p", version: "1.1.0", messages: [...] });

mesh.render("p", { version: "1.0.0", variables: {} });
```

If you don't pin a version, the **latest** is used.

## A/B experiments

```ts
mesh.experiment("support-agent", {
  variants: [
    { name: "control",   weight: 1, version: "1.0.0" },
    { name: "concise",   weight: 1, version: "1.1.0" },
  ],
});

const result = await mesh.run("support-agent", { variables: { message: "hi" } });
console.log(result.prompt.variant);   // "control" or "concise"
```

Variant selection is **deterministic per seed** (default: variables + tags), so the same user keeps landing in the same bucket.

## Caching

Identical rendered prompts are deduplicated automatically via a stable hash:

```ts
await mesh.run("p", { variables: { q: "x" }, cacheTtlMs: 60_000 });
await mesh.run("p", { variables: { q: "x" } }); // cached: true
```

Plug in any cache by implementing the `CacheStore` interface.

## Fallbacks

```ts
const result = await mesh.run("p", {
  provider: async (prompt) => callOpenAI(prompt.messages),
  fallbacks: [async (prompt) => callAnthropic(prompt.messages)],
});
```

`promptmesh` tries providers in order and records every error in `result.errors`.

## Analytics

```ts
mesh.stats();
// {
//   totalCalls: 142,
//   cacheHits: 38,
//   cacheMisses: 104,
//   errors: 2,
//   byVariant: { control: { calls: 70, avgLatencyMs: 412 }, concise: { calls: 72, avgLatencyMs: 380 } }
// }
```

## API

| Symbol | Description |
| --- | --- |
| `createMesh(options)` / `new PromptMesh(options)` | Construct the mesh |
| `mesh.register({ name, version, messages, metadata })` | Add a prompt version |
| `mesh.experiment(name, { variants })` | Define A/B routing |
| `mesh.render(name, { variables, version, variant })` | Pure render, no provider call |
| `mesh.run(name, options)` | Render + cache + execute provider chain |
| `mesh.stats()` / `mesh.resetAnalytics()` | Telemetry |
| `MemoryCache`, `PromptRegistry`, `pickVariant`, `renderTemplate` | Lower-level pieces |

## License

MIT
