import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Severity } from "./types.js";

export interface DriftConfig {
  failOn?: Severity;
  ignore?: string[];
  workspaceGlobs?: string[];
}

export function loadConfig(cwd: string): DriftConfig {
  const f = join(cwd, ".driftrc.json");
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, "utf8")) as DriftConfig;
  } catch {
    return {};
  }
}
