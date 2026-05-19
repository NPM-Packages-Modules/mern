# versionpress

**versionpress** reads **`x-api-version`** (configurable), sets **`req.apiVersion`**, and can emit a **`Warning`** header for deprecated versions.

```ts
import express from "express";
import { versionpress, stripVersionPrefix } from "@mr-aftab-ahmad-khan/versionpress";

app.use(versionpress({ defaultVersion: "2", warnIfLte: "1" }));
app.use("/v1", stripVersionPrefix("/v1"), v1Router);
```

MIT © Aftab Ahmad Khan
