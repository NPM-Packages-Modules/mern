import type { Finding, RiskLevel } from "./types.js";

const SEVERITY_ORDER: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function maxSeverity(findings: Finding[]): RiskLevel {
  let worst: RiskLevel = "info";
  for (const f of findings) {
    if (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[worst]) worst = f.severity;
  }
  return worst;
}

export function severityAtLeast(a: RiskLevel, b: RiskLevel): boolean {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b];
}

export interface ScriptScore {
  score: number;
  reasons: string[];
}

export function scoreInstallScript(script: string): ScriptScore {
  const reasons: string[] = [];
  let score = 0;
  const lower = script.toLowerCase();

  if (/(curl|wget)\s+[^|]+\|\s*(sh|bash|zsh|node)/i.test(script)) {
    score += 5;
    reasons.push("curl/wget piped to a shell or node");
  }
  if (/\bbase64\b/.test(lower) && /\b(eval|exec)\b/.test(lower)) {
    score += 5;
    reasons.push("base64 combined with eval/exec");
  }
  if (/\bnew\s+Function\s*\(/.test(script)) {
    score += 3;
    reasons.push("dynamic `new Function()` invocation");
  }
  if (/process\.env(\.|\[)/.test(script)) {
    score += 2;
    reasons.push("reads process.env at install time");
  }
  if (/https?:\/\/(?!registry\.npmjs\.org|nodejs\.org|github\.com)[^\s'"`]+/i.test(script)) {
    score += 3;
    reasons.push("network call to a non-trusted domain");
  }
  if (/[A-Za-z0-9+/]{200,}={0,2}/.test(script)) {
    score += 3;
    reasons.push("very long opaque token (possible obfuscation)");
  }
  if (script.length > 300 && !script.includes("\n")) {
    score += 2;
    reasons.push("obfuscated one-liner > 300 chars");
  }

  return { score: Math.min(score, 10), reasons };
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

export function findTyposquatCandidate(
  name: string,
  topPackages: readonly string[],
): string | undefined {
  if (topPackages.includes(name)) return undefined;
  for (const top of topPackages) {
    if (Math.abs(top.length - name.length) > 2) continue;
    const dist = levenshtein(name, top);
    if (dist > 0 && dist <= 2) return top;
  }
  return undefined;
}
