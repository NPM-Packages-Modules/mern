export type Finding = { rule: string; severity: "error" | "warn"; message: string; line?: number; file: string };

const PATTERNS: { rule: string; severity: Finding["severity"]; re: RegExp; message: string }[] = [
  {
    rule: "eval",
    severity: "error",
    re: /\beval\s*\(/,
    message: "Avoid eval — remote code execution risk.",
  },
  {
    rule: "child_process.exec",
    severity: "warn",
    re: /child_process\.exec\(/,
    message: "Prefer execFile/spawn with argument arrays to limit shell injection.",
  },
  {
    rule: "sql-string-concat",
    severity: "warn",
    re: /(?:query|execute)\s*\(\s*[`'"]\s*SELECT.+\$\{/i,
    message: "Possible SQL injection via template literal — use parameterized queries.",
  },
  {
    rule: "wildcard-cors",
    severity: "warn",
    re: /Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/,
    message: "Wildcard CORS with credentials is dangerous — scope origins explicitly.",
  },
];

export function scanSource(file: string, content: string): Finding[] {
  const lines = content.split(/\r?\n/);
  const out: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        out.push({ rule: p.rule, severity: p.severity, message: p.message, file, line: i + 1 });
      }
    }
  }
  if (!/helmet\s*\(/.test(content) && /\.(get|post|put|delete|patch)\s*\(/.test(content)) {
    out.push({
      rule: "missing-helmet",
      severity: "warn",
      message: "No helmet() call detected — consider setting secure HTTP headers.",
      file,
    });
  }
  return out;
}

export function mergeFindings(findings: Finding[]): { errors: number; warns: number } {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warns: findings.filter((f) => f.severity === "warn").length,
  };
}
