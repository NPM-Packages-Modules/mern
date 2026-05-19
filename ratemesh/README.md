# ratemesh

Express **sliding-window rate limiter** with optional **adaptive tightening** when a client triggers many **4xx** responses (lightweight bot / abuse signal).

```ts
import { ratemesh } from "@mr-aftab-ahmad-khan/ratemesh";

app.use(
  ratemesh({
    windowMs: 60_000,
    max: 120,
    adaptive: true,
    errorThreshold: 20,
    penaltyFactor: 0.5,
  }),
);
```

## License

MIT
