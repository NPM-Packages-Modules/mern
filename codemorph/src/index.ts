import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function* walkDir(absDir: string, skip: Set<string>): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(absDir, e.name);
    if (e.isDirectory()) {
      if (skip.has(e.name)) continue;
      yield* walkDir(p, skip);
    } else {
      yield p;
    }
  }
}

/** Collapse whitespace-only lines so copies with different indentation still match. */
export function normalizeSourceLines(src: string): string {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

export interface DuplicateReport {
  digest: string;
  files: string[];
}

/**
 * Find distinct files whose normalized text matches — useful for spotting duplicated controllers/services.
 */
export async function findDuplicateSources(
  rootDir: string,
  opts?: { extensions?: RegExp; skipDirs?: Set<string> }
): Promise<DuplicateReport[]> {
  const ext = opts?.extensions ?? /\.(m?[jt]s|tsx?)$/i;
  const skip = opts?.skipDirs ?? new Set(["node_modules", "dist", ".git", "coverage"]);
  const map = new Map<string, string[]>();
  const root = path.resolve(rootDir);
  for await (const file of walkDir(root, skip)) {
    if (!ext.test(file)) continue;
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const digest = createHash("sha256").update(normalizeSourceLines(raw)).digest("hex");
    if (!map.has(digest)) map.set(digest, []);
    map.get(digest)!.push(file);
  }
  return [...map.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([digest, files]) => ({ digest, files: files.sort() }));
}
