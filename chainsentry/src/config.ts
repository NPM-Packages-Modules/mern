import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RiskLevel } from "./types.js";

export interface DepguardConfig {
  failOn?: RiskLevel;
  ignore?: string[];
  baselinePath?: string;
  cacheTTL?: number;
  scanDepth?: "direct" | "all";
}

export function loadConfig(cwd: string): DepguardConfig {
  const file = join(cwd, ".depguardrc.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as DepguardConfig;
  } catch {
    return {};
  }
}
