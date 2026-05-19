# jobforge

**Topics:** `cron` · `jobforge` · `jobs` · `mern` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `queue` · `retry` · `typescript` · `worker`

Small **background job** helper for Node: **retries**, **backoff**, **delay**, **fixed intervals**, and a **`monitoring()`** snapshot so you can build your own dashboard later.

```ts
import { JobForge } from "@mr-aftab-ahmad-khan/jobforge";

const jobs = new JobForge();
jobs.schedule("emails", () => sendEmails(), {
  everyMs: 60_000,
  retries: 5,
  maxBackoffMs: 30_000,
});
```

Distributed queues (Redis, SQS) are intentionally out of scope for this core package—wrap `schedule` with your transport.

## License

MIT
