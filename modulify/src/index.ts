import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Express, Router } from "express";

export interface ModulifyMount {
  /** Express mount path, e.g. `/users` */
  mountPath: string;
  router: Router;
}

const DEFAULT_PATTERN = /\.router\.[cm]?js$/i;

/** Derive `/segment` from `users.router.js` → `/users` */
export function mountPathFromFilename(filename: string, pattern: RegExp = /\.router\.[cm]?js$/i): string {
  const stem = filename.replace(pattern, "");
  return stem.startsWith("/") ? stem : `/${stem}`;
}

/**
 * Dynamically import `*.router.js` (or custom `pattern`) from a directory.
 * Each module should `export default` an Express `Router` or `export const router`.
 */
export async function loadRoutersFromDir(
  absoluteDir: string,
  opts?: { pattern?: RegExp }
): Promise<ModulifyMount[]> {
  const pattern = opts?.pattern ?? DEFAULT_PATTERN;
  const out: ModulifyMount[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const ent of entries) {
    if (!ent.isFile() || !pattern.test(ent.name)) continue;
    const full = path.join(absoluteDir, ent.name);
    const mod = (await import(pathToFileURL(full).href)) as { default?: Router; router?: Router };
    const router = mod.router ?? mod.default;
    if (!router) continue;
    out.push({ mountPath: mountPathFromFilename(ent.name, pattern), router });
  }
  return out;
}

/** Scan `absoluteDir` and `app.use(mountPath, router)` for each discovered module. */
export async function modulify(app: Express, absoluteDir: string, opts?: { pattern?: RegExp }): Promise<ModulifyMount[]> {
  const mounts = await loadRoutersFromDir(absoluteDir, opts);
  for (const m of mounts) app.use(m.mountPath, m.router);
  return mounts;
}
