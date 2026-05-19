# replaystack

**replaystack** replays a **JSON array** of captured requests against a **`--base` URL** — a minimal local repro loop before proper APM trace import.

```bash
npx replaystack replay ./captures.json --base http://localhost:4000
```

Array shape: `[{ "method": "POST", "url": "/api/x", "headers": {}, "body": {} }]`

MIT © Aftab Ahmad Khan
