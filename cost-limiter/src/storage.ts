import type { Window } from "./types.js";

export interface StorageAdapter {
  /** Increment the spend counter for the given key/window and return the new total. */
  increment(key: string, amount: number, window: Window, resetAt: Date): Promise<number>;
  /** Read the current spend for the given key/window. */
  get(key: string, window: Window): Promise<number>;
  /** Reset (clear) all windows for the given key. */
  reset(key: string): Promise<void>;
}

export const WINDOWS: Window[] = ["minute", "hour", "day", "month"];

export function windowResetAt(now: Date, window: Window): Date {
  const d = new Date(now);
  switch (window) {
    case "minute":
      d.setUTCSeconds(0, 0);
      d.setUTCMinutes(d.getUTCMinutes() + 1);
      return d;
    case "hour":
      d.setUTCMinutes(0, 0, 0);
      d.setUTCHours(d.getUTCHours() + 1);
      return d;
    case "day":
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
    case "month":
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
  }
}

export function windowBucket(now: Date, window: Window): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  switch (window) {
    case "minute": return `${y}${m}${d}${h}${min}`;
    case "hour":   return `${y}${m}${d}${h}`;
    case "day":    return `${y}${m}${d}`;
    case "month":  return `${y}${m}`;
  }
}

export class MemoryCostStorage implements StorageAdapter {
  private store = new Map<string, { value: number; resetAt: number }>();

  async increment(key: string, amount: number, window: Window, resetAt: Date) {
    const fullKey = `${key}:${window}`;
    const entry = this.store.get(fullKey);
    if (entry && entry.resetAt <= Date.now()) {
      this.store.delete(fullKey);
    }
    const cur = this.store.get(fullKey) ?? { value: 0, resetAt: resetAt.getTime() };
    cur.value = +(cur.value + amount).toFixed(6);
    this.store.set(fullKey, cur);
    return cur.value;
  }

  async get(key: string, window: Window): Promise<number> {
    const entry = this.store.get(`${key}:${window}`);
    if (!entry) return 0;
    if (entry.resetAt <= Date.now()) {
      this.store.delete(`${key}:${window}`);
      return 0;
    }
    return entry.value;
  }

  async reset(key: string): Promise<void> {
    for (const w of WINDOWS) this.store.delete(`${key}:${w}`);
  }
}

interface RedisLike {
  incrbyfloat(key: string, amount: number): Promise<string>;
  pexpire(key: string, ms: number): Promise<number>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
}

export class RedisCostStorage implements StorageAdapter {
  constructor(private redis: RedisLike, private prefix = "cost-limiter") {}

  private key(k: string, w: Window) { return `${this.prefix}:${k}:${w}`; }

  async increment(key: string, amount: number, window: Window, resetAt: Date) {
    const k = this.key(key, window);
    const newVal = await this.redis.incrbyfloat(k, amount);
    const ttl = Math.max(1, resetAt.getTime() - Date.now());
    await this.redis.pexpire(k, ttl);
    return Number(newVal);
  }

  async get(key: string, window: Window) {
    const v = await this.redis.get(this.key(key, window));
    return v ? Number(v) : 0;
  }

  async reset(key: string) {
    await this.redis.del(...WINDOWS.map((w) => this.key(key, w)));
  }
}
