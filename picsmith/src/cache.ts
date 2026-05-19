import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TransformOptions } from "./types.js";

export interface CacheEntry {
  buffer: Buffer;
  mimeType: string;
  etag: string;
  lastModified: Date;
}

export interface Cache {
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
}

export function makeCacheKey(sourceKey: string, opts: TransformOptions, mtime: number): string {
  const json = JSON.stringify({ sourceKey, opts, mtime });
  return createHash("sha1").update(json).digest("hex");
}

export class LruCache implements Cache {
  private map = new Map<string, CacheEntry>();
  constructor(private readonly maxItems = 256) {}
  get(key: string) {
    const v = this.map.get(key);
    if (!v) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key: string, entry: CacheEntry) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, entry);
    while (this.map.size > this.maxItems) {
      const firstKey = this.map.keys().next().value as string | undefined;
      if (firstKey === undefined) break;
      this.map.delete(firstKey);
    }
  }
}

export class DiskCache implements Cache {
  constructor(public readonly dir: string) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  private file(key: string) {
    return join(this.dir, key);
  }
  private meta(key: string) {
    return join(this.dir, `${key}.json`);
  }
  get(key: string): CacheEntry | undefined {
    if (!existsSync(this.file(key))) return undefined;
    try {
      const meta = JSON.parse(readFileSync(this.meta(key), "utf8")) as { mimeType: string; etag: string };
      const stat = statSync(this.file(key));
      return {
        buffer: readFileSync(this.file(key)),
        mimeType: meta.mimeType,
        etag: meta.etag,
        lastModified: stat.mtime,
      };
    } catch {
      return undefined;
    }
  }
  set(key: string, entry: CacheEntry) {
    writeFileSync(this.file(key), entry.buffer);
    writeFileSync(this.meta(key), JSON.stringify({ mimeType: entry.mimeType, etag: entry.etag }), "utf8");
  }
}
