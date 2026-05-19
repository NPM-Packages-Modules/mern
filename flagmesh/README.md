# flagmesh

**flagmesh** is a tiny **feature-flag** helper: boolean rules, **`process.env` toggles**, and **percent rollouts** with stable hashing per `userId`.

```ts
import { Flagmesh } from "@mr-aftab-ahmad-khan/flagmesh";

const flags = new Flagmesh({ legacyUi: false });
flags.setRule("newDashboard", { kind: "percent", value: 25 });

flags.isEnabled("newDashboard", { userId: req.user.id });
```

MIT © Aftab Ahmad Khan
