import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface BaselineEntry {
  maintainers: string[];
  version: string;
}
export type Baseline = Record<string, BaselineEntry>;

const BASELINE_DIR = join(homedir(), ".depguard");
const BASELINE_FILE = join(BASELINE_DIR, "baseline.json");

export function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Baseline;
  } catch {
    return {};
  }
}

export function saveBaseline(b: Baseline): void {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  writeFileSync(BASELINE_FILE, JSON.stringify(b, null, 2) + "\n", "utf8");
}

export function collectMaintainersFromDisk(cwd: string): Baseline {
  const baseline: Baseline = {};
  const nm = join(cwd, "node_modules");
  if (!existsSync(nm)) return baseline;
  for (const entry of readdirSync(nm)) {
    if (entry.startsWith(".")) continue;
    const dir = join(nm, entry);
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name?: string;
        version?: string;
        maintainers?: Array<{ name: string }>;
      };
      if (pkg.name && pkg.version) {
        baseline[pkg.name] = {
          maintainers: (pkg.maintainers ?? []).map((m) => m.name).sort(),
          version: pkg.version,
        };
      }
    } catch {
      // ignore unreadable packages
    }
  }
  return baseline;
}
