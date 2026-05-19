import { dirname, join, resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import type { ModuleInfo } from "./types.js";

const IMPORT_REGEXES = [
  /import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /export\s+(?:[*\w{},\s]+?\s+from\s+)['"]([^'"]+)['"]/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const EXPORT_REGEXES = [
  /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g,
  /export\s*\{\s*([^}]+)\s*\}/g,
];

const DEFAULT_EXPORT_REGEX = /export\s+default\b/;

const CANDIDATE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs", "index.cjs"];

export function extractImports(content: string): string[] {
  const seen = new Set<string>();
  for (const regex of IMPORT_REGEXES) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) seen.add(match[1]);
    }
  }
  return Array.from(seen);
}

export function extractExports(content: string): { exports: string[]; hasDefault: boolean } {
  const names = new Set<string>();
  for (const regex of EXPORT_REGEXES) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const captured = match[1];
      if (!captured) continue;
      if (captured.includes(",") || captured.includes("as")) {
        for (const part of captured.split(",")) {
          const name = part.split(/\s+as\s+/i)[0]?.trim();
          if (name) names.add(name);
        }
      } else {
        names.add(captured.trim());
      }
    }
  }
  return { exports: Array.from(names), hasDefault: DEFAULT_EXPORT_REGEX.test(content) };
}

export function countLOC(content: string): number {
  if (!content) return 0;
  return content.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith("//")).length;
}

export function buildModuleInfo(file: string, content: string): ModuleInfo {
  const imports = extractImports(content);
  const { exports, hasDefault } = extractExports(content);
  return {
    file,
    loc: countLOC(content),
    imports,
    exports,
    hasDefaultExport: hasDefault,
  };
}

export function resolveImport(fromFile: string, spec: string, rootDir: string): string | undefined {
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    return undefined;
  }
  const base = spec.startsWith("/") ? resolve(rootDir, `.${spec}`) : resolve(dirname(fromFile), spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of CANDIDATE_EXTS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const idx of INDEX_FILES) {
    const candidate = join(base, idx);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}
