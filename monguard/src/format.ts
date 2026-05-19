import pc from "picocolors";
import type { Warning, MonguardStats } from "./types.js";

const SEVERITY_COLOR: Record<Warning["severity"], (s: string) => string> = {
  info: pc.cyan,
  warn: pc.yellow,
  error: pc.red,
};

export function formatWarning(w: Warning): string {
  const sev = SEVERITY_COLOR[w.severity](w.severity.toUpperCase());
  const head = `[monguard ${sev}] ${w.message}`;
  const detail = w.suggestion ? `\n  ${pc.dim("→")} ${w.suggestion}` : "";
  const meta = `\n  ${pc.dim(`op=${w.query.op} duration=${w.query.durationMs}ms collection=${w.query.collection}`)}`;
  return `${head}${detail}${meta}`;
}

export function formatStats(stats: MonguardStats): string {
  const lines = [
    pc.bold("monguard report"),
    `  queries: ${stats.totalQueries}, slow: ${stats.slowQueries}, total time: ${stats.totalDurationMs}ms`,
    `  warnings:`,
  ];
  for (const [kind, count] of Object.entries(stats.warnings)) {
    if (count > 0) lines.push(`    - ${kind}: ${count}`);
  }
  if (stats.topSlow.length > 0) {
    lines.push("  top slow:");
    for (const q of stats.topSlow.slice(0, 5)) {
      lines.push(`    ${q.op} ${q.collection} ${q.durationMs}ms`);
    }
  }
  if (stats.topDuplicate.length > 0) {
    lines.push("  most duplicated:");
    for (const d of stats.topDuplicate.slice(0, 5)) {
      lines.push(`    ×${d.count}  ${d.key}`);
    }
  }
  return lines.join("\n");
}
