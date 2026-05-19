# heapguard

**Topics:** `heap` · `heapguard` · `memory` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `performance` · `typescript`

**heapguard** samples **Node heap usage**, exposes **v8 heap statistics**, and runs a tiny **growth-factor monitor** for leak suspects (MVP heuristic — pair with APM for production).

```ts
import { monitor, sampleHeap, heapStatistics } from "@mr-aftab-ahmad-khan/heapguard";

const stop = monitor({
  growthFactor: 1.5,
  onLeakSuspect: (a, b, f) => console.warn("heap jump", f, a, b),
});
```

MIT © Aftab Ahmad Khan
