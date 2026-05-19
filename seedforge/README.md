# seedforge

**Smart database seeder** — register ordered async seeds and replay them with a **deterministic PRNG** so CI and laptops see the same pseudo-random fixtures.

## Install

```bash
npm install @mr-aftab-ahmad-khan/seedforge
```

## API

```typescript
import { seedforge } from "@mr-aftab-ahmad-khan/seedforge";

const sf = seedforge();

sf.register("users", async ({ random, log }) => {
  log("creating users...");
  const n = Math.floor(random() * 10);
  // await User.create(...)
  void n;
});

await sf.runAll({ seed: Number(process.env.SEED ?? "42") });
```

## CLI

```bash
npx seedforge run --seed 7
```

Wire this into your scripts; actual Mongoose / Prisma calls stay in your repo.

## License

MIT
