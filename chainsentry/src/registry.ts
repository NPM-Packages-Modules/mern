import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RegistryPackument {
  name: string;
  maintainers?: Array<{ name: string; email?: string }>;
  time?: Record<string, string>;
  versions?: Record<string, unknown>;
  "dist-tags"?: Record<string, string>;
}

interface CacheEntry {
  expiresAt: number;
  data: RegistryPackument;
}

const CACHE_DIR = join(homedir(), ".depguard", "cache");

function cacheFile(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(CACHE_DIR, `${safe}.json`);
}

function readCache(name: string): RegistryPackument | undefined {
  const file = cacheFile(name);
  if (!existsSync(file)) return undefined;
  try {
    const entry = JSON.parse(readFileSync(file, "utf8")) as CacheEntry;
    if (entry.expiresAt > Date.now()) return entry.data;
  } catch {
    return undefined;
  }
  return undefined;
}

function writeCache(name: string, data: RegistryPackument, ttlMs: number): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const entry: CacheEntry = { expiresAt: Date.now() + ttlMs, data };
  writeFileSync(cacheFile(name), JSON.stringify(entry), "utf8");
}

export interface FetchOptions {
  ttlMs?: number;
  fetcher?: (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export async function fetchPackument(
  name: string,
  opts: FetchOptions = {},
): Promise<RegistryPackument | undefined> {
  const ttl = opts.ttlMs ?? 60 * 60 * 1000;
  const cached = readCache(name);
  if (cached) return cached;
  const fetcher = opts.fetcher ?? (globalThis.fetch as typeof fetch);
  if (!fetcher) return undefined;
  try {
    const res = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(name).replace("%40", "@")}`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as RegistryPackument;
    writeCache(name, data, ttl);
    return data;
  } catch {
    return undefined;
  }
}
