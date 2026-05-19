import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { EnvSource } from "./types.js";

export function parseDotEnv(content: string): EnvSource {
  const result: EnvSource = {};
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    value = value.replace(/\\n/g, "\n");
    result[key] = value;
  }
  return result;
}

export function loadDotEnv(filePath: string = ".env", cwd: string = process.cwd()): EnvSource {
  const absolute = resolve(cwd, filePath);
  if (!existsSync(absolute)) return {};
  const text = readFileSync(absolute, "utf8");
  return parseDotEnv(text);
}

export function mergeSources(...sources: EnvSource[]): EnvSource {
  const merged: EnvSource = {};
  for (const s of sources) {
    for (const [key, value] of Object.entries(s)) {
      if (value === undefined) continue;
      merged[key] = value;
    }
  }
  return merged;
}
