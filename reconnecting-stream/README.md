# reconnecting-stream

**Topics:** `backoff` · `eventsource` · `heartbeat` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `reconnect` · `reconnecting-stream` · `sse` · `stream` · `typescript` · `websocket`

[![npm version](https://img.shields.io/npm/v/reconnecting-stream.svg)](https://www.npmjs.com/package/reconnecting-stream)
[![bundle size](https://img.shields.io/bundlephobia/minzip/reconnecting-stream)](https://bundlephobia.com/package/reconnecting-stream)
[![license](https://img.shields.io/npm/l/reconnecting-stream.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Every codebase has a broken `EventSource` that drops messages on flaky connections.** `reconnecting-stream` is the reconnection logic you've written 5 times, done right. It gives you **SSE** and **WebSocket** clients with:

- 🔁 Full-jitter exponential backoff (prevents thundering herd)
- ❤️ Heartbeat detection that closes silent connections before TCP does
- 📦 Message queue that holds outgoing data while disconnected
- 🪪 SSE `Last-Event-ID` resend on every reconnect
- 🧰 Custom headers, custom transports, tiny bundle, browser + Node.js

---

## Installation

```bash
npm install reconnecting-stream
pnpm add reconnecting-stream
yarn add reconnecting-stream
# Optional Node.js WebSocket fallback:
npm install ws
```

---

## Quick Start

```ts
import { ReconnectingSSE } from "reconnecting-stream";

const sse = new ReconnectingSSE("https://api.example.com/events");
sse.on("message", (e) => console.log(e.data));
sse.on("reconnect", (e) => console.log(`reconnecting (attempt ${e.attempt}, delay ${e.delay}ms)`));
```

---

## Core Usage Examples

### 1. Basic SSE with reconnect logging

```ts
import { ReconnectingSSE } from "reconnecting-stream";

const sse = new ReconnectingSSE("https://api.example.com/events");
sse.on("message", (e) => console.log("data:", e.data));
sse.on("state", (s) => console.log(`state ${s.from} → ${s.to}`));
sse.on("reconnect", (r) => console.log(`reconnecting (${r.attempt})`));
```

### 2. SSE with auth headers and heartbeat

```ts
const sse = new ReconnectingSSE("https://api.example.com/events", {
  headers: { Authorization: "Bearer token" },
  heartbeat: { interval: 30_000, timeout: 60_000, event: "ping" },
});
```

### 3. WebSocket with queuing during disconnects

```ts
import { ReconnectingWebSocket } from "reconnecting-stream";

const ws = new ReconnectingWebSocket("wss://ws.example.com/live", {
  queue: { maxSize: 50, flushOnReconnect: true },
});

ws.send(JSON.stringify({ type: "subscribe", channel: "ticker" })); // queued if not yet open
```

### 4. WebSocket with ping/pong keepalive

```ts
const ws = new ReconnectingWebSocket("wss://ws.example.com", {
  pingInterval: 25_000,
  pongTimeout: 5_000,
});
```

### 5. Watching the full state machine

```ts
import type { ConnectionState } from "reconnecting-stream";

const states: ConnectionState[] = [];
sse.on("state", (s) => states.push(s.to));
// connecting → connected → reconnecting → connected → closed
```

### 6. teeStream-like pattern: log everything while processing

```ts
sse.on("message", (e) => { logToFile(e.data); });
sse.on("message", (e) => { processData(e.data); });
```

---

## Framework Integration Examples

### React — `useReconnectingSSE`

```ts
import { useEffect, useState } from "react";
import { ReconnectingSSE, type SSEEvent, type ConnectionState } from "reconnecting-stream";

export function useReconnectingSSE(url: string) {
  const [messages, setMessages] = useState<SSEEvent[]>([]);
  const [state, setState] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const sse = new ReconnectingSSE(url);
    sse.on("message", (e) => setMessages((m) => [...m, e]));
    sse.on("state", (s) => setState(s.to));
    sse.on("error", (e) => setError(e.error));
    return () => sse.close();
  }, [url]);
  return { messages, state, error };
}
```

### React — `useReconnectingWebSocket`

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { ReconnectingWebSocket, type ConnectionState } from "reconnecting-stream";

export function useReconnectingWebSocket(url: string) {
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [state, setState] = useState<ConnectionState>("connecting");
  useEffect(() => {
    const ws = new ReconnectingWebSocket(url);
    wsRef.current = ws;
    ws.on("message", (e) => setMessages((m) => [...m, e.data]));
    ws.on("state", (s) => setState(s.to));
    return () => ws.close();
  }, [url]);
  const send = useCallback((d: string) => wsRef.current?.send(d), []);
  return { messages, send, state };
}
```

### Node.js — proxy an upstream feed to many clients

```ts
import { ReconnectingSSE } from "reconnecting-stream";

const upstream = new ReconnectingSSE("https://feed.example.com/events");
const subscribers = new Set<{ write(s: string): void }>();
upstream.on("message", (e) => {
  for (const s of subscribers) s.write(`data: ${e.data}\n\n`);
});
```

### Express SSE endpoint (the one your client connects to)

```ts
import express from "express";
const app = express();
app.get("/events", (req, res) => {
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 1000);
  req.on("close", () => clearInterval(interval));
});
app.listen(3000);
```

---

## Configuration Reference

### `new ReconnectingSSE(url, options)`

| Option       | Type                    | Default | Description                                |
| ------------ | ----------------------- | ------- | ------------------------------------------ |
| `backoff`    | `BackoffConfig`         | defaults| Full-jitter exponential backoff settings   |
| `heartbeat`  | `HeartbeatConfig`       | `undefined` | Idle-timer reconnect trigger          |
| `headers`    | `Record<string, string>`| `{}`    | Extra headers (e.g. Bearer token)          |
| `fetch`      | `typeof fetch`          | `globalThis.fetch` | Override for tests              |

### `new ReconnectingWebSocket(url, options)`

| Option           | Type                          | Default | Description                                |
| ---------------- | ----------------------------- | ------- | ------------------------------------------ |
| `backoff`        | `BackoffConfig`               | defaults| Backoff settings                            |
| `queue`          | `QueueConfig`                 | `{}`    | Outgoing message queue config              |
| `pingInterval`   | `number`                      | `undefined` | Send `"ping"` every N ms              |
| `pongTimeout`    | `number`                      | `undefined` | Disconnect if no message within N ms after ping |
| `protocols`      | `string \| string[]`          | —       | WebSocket sub-protocols                    |
| `WebSocketCtor`  | `typeof WebSocket`            | global  | E.g. `import WS from 'ws'`                 |

### `BackoffConfig`

| Field          | Type     | Default     | Description                                  |
| -------------- | -------- | ----------- | -------------------------------------------- |
| `initial`      | `number` | `1000`      | First delay                                  |
| `max`          | `number` | `30_000`    | Cap                                          |
| `multiplier`   | `number` | `2`         | Geometric multiplier                         |
| `jitter`       | `number` | `1`         | Jitter fraction; `1` = full jitter           |
| `resetAfterMs` | `number` | `60_000`    | Reset attempt counter after this connected duration |
| `maxAttempts`  | `number` | `Infinity`  | Give up after this many failed reconnects    |

### `HeartbeatConfig`

| Field      | Type     | Default  | Description                          |
| ---------- | -------- | -------- | ------------------------------------ |
| `interval` | `number` | `30_000` | Expected heartbeat frequency         |
| `timeout`  | `number` | `60_000` | Reconnect if no heartbeat within ms  |
| `event`    | `string` | any      | Limit reset to a specific event name |

### `QueueConfig`

| Field             | Type                                   | Default        | Description                  |
| ----------------- | -------------------------------------- | -------------- | ---------------------------- |
| `maxSize`         | `number`                               | `100`          | Max queued messages          |
| `onOverflow`      | `"drop-oldest" \| "drop-newest" \| "throw"` | `"drop-oldest"` | Overflow strategy        |
| `flushOnReconnect`| `boolean`                              | `true`         | Send queue when reconnected  |

---

## Backoff Algorithm Explained

Full jitter (recommended by [AWS' Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)):

```
delay = random(0, min(cap, initial * multiplier^attempt))
```

| Attempt | Cap (initial=1s, max=30s, multiplier=2) | Sample delay (jitter=1) |
| ------- | --------------------------------------: | ----------------------: |
| 0       |                                      1s |              `[0, 1s]`  |
| 1       |                                      2s |              `[0, 2s]`  |
| 2       |                                      4s |              `[0, 4s]`  |
| 3       |                                      8s |              `[0, 8s]`  |
| 4       |                                     16s |              `[0, 16s]` |
| 5       |                                     30s |              `[0, 30s]` |
| 6+      |                                     30s |              `[0, 30s]` |

Full jitter beats equal jitter and decorrelated jitter because every client's next retry time is drawn from a uniform distribution — under a mass outage, 1000 clients reconnecting will spread across the entire `[0, cap]` window, smoothing the thundering herd on your origin.

---

## Error Handling

```ts
sse.on("error", ({ error }) => console.error(error));

// Recoverable: drops the connection and triggers a reconnect.
// Fatal: emitted via "close" and "state: closed" — never recovers.

// Custom 'give up after N attempts':
const sse = new ReconnectingSSE(url, { backoff: { maxAttempts: 10 } });
sse.on("close", () => console.warn("permanently closed"));
```

---

## TypeScript Types

```ts
import type {
  SSEEvent,
  ReconnectEvent,
  StateChangeEvent,
  BackoffConfig,
  HeartbeatConfig,
  QueueConfig,
  ConnectionState,
} from "reconnecting-stream";

const sse = new ReconnectingSSE(url);
sse.on("message", (e: SSEEvent) => { e.data; e.id; e.event; });
sse.on("reconnect", (e: ReconnectEvent) => { e.attempt; e.delay; });
sse.on("state", (e: StateChangeEvent) => { e.from; e.to; });
```

---

## Real-World Recipe — Live Dashboard with SSE

```ts
// server.ts
import express from "express";
const app = express();
app.get("/metrics", (req, res) => {
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  const i = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 30_000);
  const m = setInterval(() => {
    res.write(`event: metrics\ndata: ${JSON.stringify({ cpu: Math.random(), ts: Date.now() })}\n\n`);
  }, 1000);
  req.on("close", () => { clearInterval(i); clearInterval(m); });
});
app.listen(3000);
```

```tsx
// LiveDashboard.tsx
import { useEffect, useState } from "react";
import { ReconnectingSSE, type ConnectionState } from "reconnecting-stream";

export function LiveDashboard() {
  const [latest, setLatest] = useState<unknown>(null);
  const [state, setState] = useState<ConnectionState>("connecting");
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  useEffect(() => {
    const sse = new ReconnectingSSE("/metrics", {
      heartbeat: { interval: 30_000, timeout: 90_000, event: "ping" },
      queue: { maxSize: 50, onOverflow: "drop-oldest" } as never,
    });
    sse.on("message", (e) => {
      if (e.event === "metrics") {
        setLatest(JSON.parse(e.data));
        setLastUpdate(Date.now());
      }
    });
    sse.on("state", (s) => setState(s.to));
    return () => sse.close();
  }, []);

  const stale = Date.now() - lastUpdate > 5 * 60_000;
  return (
    <div>
      <h2>Live metrics — {state}</h2>
      {state === "reconnecting" && <em>reconnecting…</em>}
      {stale && <p style={{ color: "red" }}>Showing data older than 5 minutes</p>}
      <pre>{JSON.stringify(latest, null, 2)}</pre>
    </div>
  );
}
```

---

## SSE Protocol Reference

Field-by-field handling:

| Field       | Wire example          | reconnecting-stream behaviour                              |
| ----------- | --------------------- | ---------------------------------------------------------- |
| `data:`     | `data: hello\n\n`     | Concatenated across multiple `data:` lines (newline-joined)|
| `event:`    | `event: ping\n`       | Sets `SSEEvent.event`                                      |
| `id:`       | `id: 42\n`            | Sets `SSEEvent.id`; stored as `lastEventId`                |
| `retry:`    | `retry: 5000\n`       | Floors the next reconnect delay at `5000` ms               |
| `:` (comment)| `:keepalive\n`       | Ignored                                                    |
| empty line  | `\n`                  | Dispatches a message event                                 |

On reconnect, `reconnecting-stream` automatically sends the most recent `id` back as the `Last-Event-ID` header — your server can replay missed events without protocol changes.

---

## Comparison Table

| Feature                | Native `EventSource` | `eventsource` npm | `reconnecting-eventsource` | **reconnecting-stream** |
| ---------------------- | :------------------: | :---------------: | :------------------------: | :---------------------: |
| Custom headers         |          ❌          |        ✅         |             ✅             |           ✅            |
| Auto-reconnect         |          ⚠️          |        ⚠️         |             ✅             |           ✅            |
| Exponential backoff    |          ❌          |        ❌         |             ⚠️             |           ✅            |
| Heartbeat detection    |          ❌          |        ❌         |             ❌             |           ✅            |
| Message queue          |          ❌          |        ❌         |             ❌             |           ✅            |
| WebSocket support      |          ❌          |        ❌         |             ❌             |           ✅            |
| TypeScript             |          ❌          |        ⚠️         |             ⚠️             |           ✅            |
| Browser + Node.js      |        browser       |       Node        |          browser           |           ✅            |

---

## License

MIT
