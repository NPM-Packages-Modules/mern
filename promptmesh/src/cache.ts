import type { CacheEntry, CacheStore } from "./types.js";

export class MemoryCache<T> implements CacheStore<T> {
  private map = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private defaultTtlMs?: number;

  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.defaultTtlMs = options.defaultTtlMs;
  }

  get(key: string): CacheEntry<T> | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    entry.hits += 1;
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(key: string, value: T, ttlMs?: number): CacheEntry<T> {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const storedAt = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      storedAt,
      expiresAt: ttl ? storedAt + ttl : undefined,
      hits: 0,
    };
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, entry);
    return entry;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}
