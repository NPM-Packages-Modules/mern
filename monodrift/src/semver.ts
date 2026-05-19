import type { Severity } from "./types.js";

const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?/;

export function extractVersion(range: string): { major: number; minor: number; patch: number } | undefined {
  const m = SEMVER_RE.exec(range);
  if (!m) return undefined;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function severity(a: string, b: string): Severity | "none" {
  const va = extractVersion(a);
  const vb = extractVersion(b);
  if (!va || !vb) return a === b ? "none" : "patch";
  if (va.major !== vb.major) return "major";
  if (va.minor !== vb.minor) return "minor";
  if (va.patch !== vb.patch) return "patch";
  if (a !== b) return "patch";
  return "none";
}

export function highestRange(ranges: string[]): string {
  let best = ranges[0]!;
  let bestVer = extractVersion(best);
  for (const r of ranges) {
    const v = extractVersion(r);
    if (!v) continue;
    if (!bestVer || compare(v, bestVer) > 0) {
      best = r;
      bestVer = v;
    }
  }
  return best;
}

function compare(a: { major: number; minor: number; patch: number }, b: { major: number; minor: number; patch: number }): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export const SEVERITY_RANK: Record<Severity, number> = { patch: 0, minor: 1, major: 2 };

export function maxSeverity(values: Severity[]): Severity {
  let max: Severity = "patch";
  for (const v of values) if (SEVERITY_RANK[v] > SEVERITY_RANK[max]) max = v;
  return max;
}
