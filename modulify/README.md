# modulify

**Automatic Express modularizer** — load feature routers from disk with a predictable naming convention so services, controllers, and routes stay grouped as the codebase grows.

## Install

```bash
npm install @mr-aftab-ahmad-khan/modulify express
```

## Convention

Drop compiled route files such as `users.router.js` (or `posts.router.cjs`) into a directory. Each file should export an Express `Router`:

```js
// dist/routes/users.router.js
import { Router } from "express";
const r = Router();
r.get("/", (_req, res) => res.json([]));
export default r;
```

## Usage

```typescript
import express from "express";
import { modulify } from "@mr-aftab-ahmad-khan/modulify";
import path from "node:path";

const app = express();
const routesDir = path.join(process.cwd(), "dist", "routes");
await modulify(app, routesDir);
app.listen(3000);
```

## License

MIT
