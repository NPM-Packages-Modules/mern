# syncora

**Topics:** `mern` · `mern-packages` · `merndev` · `mongodb` · `nodejs` · `npm-pm` · `observability` · `optimistic` · `react` · `realtime` · `subscription` · `sync` · `syncora` · `typescript` · `websocket`

Realtime sync engine for MERN apps. Subscribe to collections from the browser with a single hook, get live updates over WebSockets, mutate with optimistic UI, and reconnect transparently. Works with the built-in in-memory store, your MongoDB change stream, or any custom backing store you plug in.

## Install

```bash
npm install @mr-aftab-ahmad-khan/syncora
```

(`react` is an optional peer for the React hook.)

## Server

```ts
import { createServer } from "node:http";
import { SyncServer } from "@mr-aftab-ahmad-khan/syncora";

const http = createServer();
const sync = new SyncServer({ server: http });

http.listen(4000);
```

Or stand it up standalone:

```ts
const sync = new SyncServer({ port: 4000 });
console.log("listening on", sync.address());
```

Insert/update/delete via the store and every subscribed client gets the change:

```ts
sync.store.insert("todos", { _id: "t1", title: "Buy milk", done: false });
sync.store.update("todos", "t1", { done: true });
sync.store.delete("todos", "t1");
```

### Plug in MongoDB change streams

```ts
import { EventEmitter } from "node:events";
import { MongoClient } from "mongodb";

const emitter = new EventEmitter();
const off = sync.attachChangeStream(emitter);

const mongo = await MongoClient.connect(process.env.MONGODB_URI!);
const todos = mongo.db().collection("todos");
todos.watch().on("change", (event) => {
  if (event.operationType === "insert") {
    emitter.emit("change", {
      type: "insert",
      collection: "todos",
      document: event.fullDocument,
      version: Number(event.clusterTime.toString()),
    });
  }
  // …handle update / delete similarly
});
```

## Vanilla client

```ts
import { SyncoraClient } from "@mr-aftab-ahmad-khan/syncora";

const client = new SyncoraClient({ url: "ws://localhost:4000" });

const todos = client.subscribe("todos", { filter: { done: false } });
todos.onChange(({ data }) => console.log(data));

await client.mutate("todos", "insert", { document: { _id: "t9", title: "Ship it" } });
await client.mutate("todos", "update", { documentId: "t9", patch: { done: true } });
await client.mutate("todos", "delete", { documentId: "t9" });
```

Reconnects with exponential back-off, replays queued mutations and resubscribes on every reconnect.

## React hook

```tsx
import { SyncoraClient } from "@mr-aftab-ahmad-khan/syncora";
import { createSyncoraHooks } from "@mr-aftab-ahmad-khan/syncora/react";

const client = new SyncoraClient({ url: "ws://localhost:4000" });
export const { useSyncora } = createSyncoraHooks(client);

export function Todos() {
  const { data, insert, update, remove, isConnected } = useSyncora<{ _id: string; title: string; done: boolean }>(
    "todos",
    { filter: { done: false }, optimistic: true },
  );

  return (
    <div>
      <p>{isConnected ? "live" : "reconnecting…"}</p>
      <ul>
        {data.map((t) => (
          <li key={t._id}>
            <input type="checkbox" checked={t.done} onChange={() => update(t._id, { done: !t.done })} />
            {t.title}
            <button onClick={() => remove(t._id)}>delete</button>
          </li>
        ))}
      </ul>
      <button onClick={() => insert({ _id: crypto.randomUUID(), title: "New", done: false })}>add</button>
    </div>
  );
}
```

With `optimistic: true`, mutations are applied to the local cache immediately and reconciled when the server acks (or reverted on the next snapshot).

## Filter operators

`syncora` ships a tiny filter engine compatible with the most common MongoDB operators:

- equality and dotted paths (`{ "user.name": "alice" }`)
- `$eq`, `$ne`, `$in`, `$nin`, `$gt`, `$gte`, `$lt`, `$lte`, `$exists`
- `$or`, `$and`

## Auth & permissions

```ts
new SyncServer({
  authorize: ({ headers }) => Boolean(headers["x-token"]),
  permit: (clientId, message) =>
    message.type !== "mutation" || message.collection !== "secrets",
});
```

## Custom stores

Implement the `SyncStore` interface to back syncora with Postgres, Redis, or anything else:

```ts
import { SyncServer, type SyncStore } from "@mr-aftab-ahmad-khan/syncora";

const myStore: SyncStore = { /* … */ };
const sync = new SyncServer({ store: myStore });
```

## License

MIT
