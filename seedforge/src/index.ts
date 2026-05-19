/** Deterministic PRNG (mulberry32). Same numeric seed → same sequence. */
export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedContext {
  random: () => number;
  log: (...args: unknown[]) => void;
}

export class SeedForge {
  private readonly seeds: { name: string; run: (ctx: SeedContext) => void | Promise<void> }[] = [];

  register(name: string, run: (ctx: SeedContext) => void | Promise<void>): this {
    this.seeds.push({ name, run });
    return this;
  }

  async runAll(opts?: { seed?: number; log?: (...args: unknown[]) => void }): Promise<void> {
    const seed = opts?.seed ?? 42;
    const rng = createSeededRng(seed);
    const log = opts?.log ?? ((...a) => console.log(...a));
    const ctx: SeedContext = { random: rng, log };
    for (const s of this.seeds) {
      ctx.log(`[seedforge] → ${s.name} (seed=${seed})`);
      await s.run(ctx);
    }
  }
}

export function seedforge(): SeedForge {
  return new SeedForge();
}
