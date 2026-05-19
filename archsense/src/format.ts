import pc from "picocolors";
import type { AuditReport, Finding } from "./types.js";

const SEVERITY: Record<Finding["severity"], (s: string) => string> = {
  info: pc.cyan,
  warn: pc.yellow,
  error: pc.red,
};

export function formatReport(report: AuditReport, options: { color?: boolean } = {}): string {
  const color = options.color ?? true;
  const dim = color ? pc.dim : (s: string) => s;
  const bold = color ? pc.bold : (s: string) => s;
  const gradeColor = report.score >= 80 ? pc.green : report.score >= 60 ? pc.yellow : pc.red;
  const lines: string[] = [];
  lines.push(`${bold("archsense")} ${dim(`(${report.rootDir})`)}`);
  lines.push(
    `  files=${report.filesScanned}  LOC=${report.totalLOC}  edges=${report.graph.edges}  cycles=${report.graph.cycles.length}`,
  );
  lines.push(`  score: ${gradeColor(String(report.score))}/100  grade: ${gradeColor(report.grade)}`);

  const grouped = new Map<string, Finding[]>();
  for (const f of report.findings) {
    const arr = grouped.get(f.kind) ?? [];
    arr.push(f);
    grouped.set(f.kind, arr);
  }

  if (grouped.size === 0) {
    lines.push(`\n  ${pc.green("✓ no findings")}`);
    return lines.join("\n");
  }

  for (const [kind, items] of grouped) {
    lines.push(`\n  ${bold(kind)} ${dim(`×${items.length}`)}`);
    for (const f of items.slice(0, 5)) {
      const sev = (color ? SEVERITY[f.severity] : (s: string) => s)(`[${f.severity}]`);
      lines.push(`    ${sev} ${f.message}`);
      if (f.suggestion) lines.push(`      ${dim("→")} ${f.suggestion}`);
    }
    if (items.length > 5) lines.push(`    ${dim(`… and ${items.length - 5} more`)}`);
  }
  return lines.join("\n");
}

export function reportToJson(report: AuditReport): Record<string, unknown> {
  return JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
}
