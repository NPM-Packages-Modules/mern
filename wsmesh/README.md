# wsmesh

**Topics:** `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `presence` · `realtime` · `redis` · `rooms` · `typescript` · `websocket` · `wsmesh`

**Auto WebSocket infrastructure** (transport-agnostic) — **rooms**, **presence-style joins**, **`channel(name)`** helpers, and **disconnect cleanup** you can attach to `ws`, Socket.IO, or edge workers.

## Install

```bash
npm install @mr-aftab-ahmad-khan/wsmesh
```

## Example

```typescript
import { wsmesh } from "@mr-aftab-ahmad-khan/wsmesh";

const mesh = wsmesh();

function onOpen(clientId: string) {
  mesh.join("chat", clientId);
}

function onMessage(clientId: string, msg: { room?: string; text?: string }) {
  mesh.channel(msg.room ?? "chat").each((peer) => sendJson(peer, { from: clientId, text: msg.text }));
}

function onClose(clientId: string) {
  mesh.leaveAll(clientId);
}
```

Redis horizontal scaling stays an exercise for your adapter — this module keeps **consistent room bookkeeping** on a single node.

## License

MIT
