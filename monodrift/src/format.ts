import pc from "picocolors";
import type { DriftReport, Severity } from "./types.js";

const sevColor: Record<Severity, (s: string) => string> = {
  patch: pc.gray,
  minor: pc.yellow,
  major: pc.red,
};

export function formatPretty(report: DriftReport): string {
  if (report.drifted.length === 0) {
    return pc.green(`drift-check: no drift across ${report.workspaces.length} workspaces`);
  }
  const lines: string[] = [];
  lines.push(pc.bold(`drift-check — ${report.drifted.length} drifted package(s) across ${report.workspaces.length} workspaces`));
  for (const d of report.drifted) {
    lines.push("");
    lines.push(`  ${sevColor[d.severity](d.severity.toUpperCase())}  ${pc.bold(d.name)}`);
    for (const v of d.versions) {
      lines.push(`    - ${v.version}  ${pc.gray(`(${v.workspace} / ${v.field})`)}`);
    }
  }
  return lines.join("\n");
}

export function formatJson(report: DriftReport): string {
  return JSON.stringify(report, null, 2);
}
