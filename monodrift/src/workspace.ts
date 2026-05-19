import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import YAML from "yaml";
import type { WorkspacePackage } from "./types.js";

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Detect workspace format and return absolute paths to every workspace `package.json`. */
export function detectWorkspaces(root: string, extraGlobs?: string[]): string[] {
  root = resolve(root);
  const candidates = new Set<string>();
  const pnpm = join(root, "pnpm-workspace.yaml");
  if (existsSync(pnpm)) {
    try {
      const doc = YAML.parse(readFileSync(pnpm, "utf8")) as { packages?: string[] };
      for (const g of doc.packages ?? []) expandGlob(root, g, candidates);
    } catch {
      // ignore
    }
  }
  const rootPkg = readJson(join(root, "package.json"));
  if (rootPkg) {
    const ws = rootPkg.workspaces;
    if (Array.isArray(ws)) {
      for (const g of ws) if (typeof g === "string") expandGlob(root, g, candidates);
    } else if (ws && typeof ws === "object" && Array.isArray((ws as { packages?: string[] }).packages)) {
      for (const g of (ws as { packages: string[] }).packages) expandGlob(root, g, candidates);
    }
  }
  for (const g of extraGlobs ?? ["packages/*", "apps/*"]) expandGlob(root, g, candidates);

  if (candidates.size === 0) {
    candidates.add(join(root, "package.json"));
  }
  return [...candidates];
}

function expandGlob(root: string, glob: string, out: Set<string>): void {
  if (!glob.includes("*")) {
    const pj = join(root, glob, "package.json");
    if (existsSync(pj)) out.add(pj);
    return;
  }
  const segments = glob.split("/");
  expand(root, segments, 0, out);
}

function expand(dir: string, segments: string[], idx: number, out: Set<string>): void {
  if (idx === segments.length) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) out.add(pj);
    return;
  }
  const seg = segments[idx]!;
  if (seg === "*") {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const sub = join(dir, entry);
      try { if (!statSync(sub).isDirectory()) continue; } catch { continue; }
      expand(sub, segments, idx + 1, out);
    }
  } else if (seg === "**") {
    walk(dir, (d) => expand(d, segments, idx + 1, out));
  } else {
    expand(join(dir, seg), segments, idx + 1, out);
  }
}

function walk(dir: string, visit: (d: string) => void): void {
  if (!existsSync(dir)) return;
  visit(dir);
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const sub = join(dir, entry);
    try { if (statSync(sub).isDirectory()) walk(sub, visit); } catch { /* skip */ }
  }
}

export function loadWorkspaces(root: string, extraGlobs?: string[]): WorkspacePackage[] {
  return detectWorkspaces(root, extraGlobs)
    .map((file) => {
      const pj = readJson(file);
      if (!pj) return undefined;
      return {
        name: (pj.name as string) ?? dirname(file),
        version: (pj.version as string) ?? "0.0.0",
        packageJsonPath: file,
        dependencies: (pj.dependencies as Record<string, string>) ?? {},
        devDependencies: (pj.devDependencies as Record<string, string>) ?? {},
        peerDependencies: (pj.peerDependencies as Record<string, string>) ?? {},
        optionalDependencies: (pj.optionalDependencies as Record<string, string>) ?? {},
      };
    })
    .filter((p): p is WorkspacePackage => Boolean(p));
}

export function readDriftIgnore(root: string): string[] {
  const file = join(root, ".driftignore");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
}
