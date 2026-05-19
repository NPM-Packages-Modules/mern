import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".vercel",
];

const DEFAULT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export interface WalkOptions {
  ignore?: string[];
  extensions?: string[];
}

export function walkFiles(rootDir: string, options: WalkOptions = {}): string[] {
  const ignore = new Set([...DEFAULT_IGNORES, ...(options.ignore ?? [])]);
  const exts = new Set(options.extensions ?? DEFAULT_EXTS);
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (ignore.has(name)) continue;
      const full = join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        const dotIdx = name.lastIndexOf(".");
        if (dotIdx === -1) continue;
        const ext = name.slice(dotIdx);
        if (exts.has(ext)) results.push(full);
      }
    }
  }

  walk(rootDir);
  return results;
}

export function relativeFrom(rootDir: string, file: string): string {
  return relative(rootDir, file).split(sep).join("/");
}

export function readFile(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export function topFolderOf(rootDir: string, file: string): string {
  const rel = relativeFrom(rootDir, file);
  const parts = rel.split("/");
  if (parts.length <= 1) return ".";
  return parts.slice(0, Math.min(2, parts.length - 1)).join("/");
}
