# eventmesh

**eventmesh** wraps Node’s **`EventEmitter`** with **typed publish/subscribe** helpers for MERN services that are not ready for Redis yet.

```ts
import { eventmesh } from "@mr-aftab-ahmad-khan/eventmesh";

const bus = eventmesh();
bus.subscribe("order.paid", (id: string) => {});
bus.publish("order.paid", "ord_123");
```

MIT © Aftab Ahmad Khan
