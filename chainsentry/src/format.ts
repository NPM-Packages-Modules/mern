import pc from "picocolors";
import type { PackageRisk, RiskLevel, ScanResult } from "./types.js";

const sevColor: Record<RiskLevel, (s: string) => string> = {
  info: pc.gray,
  low: pc.blue,
  medium: pc.yellow,
  high: pc.magenta,
  critical: pc.red,
};

export function formatReport(result: ScanResult): string {
  if (result.packages.length === 0) {
    return pc.green(`✓ No risk findings across ${result.totalPackages} packages`);
  }
  const lines: string[] = [];
  lines.push(pc.bold(`depguard report — ${result.packages.length} package(s) with findings (of ${result.totalPackages} scanned)`));
  for (const p of result.packages) {
    lines.push("");
    lines.push(`  ${sevColor[p.worstSeverity](p.worstSeverity.toUpperCase())}  ${pc.bold(p.name)}@${p.version}  score=${p.totalScore}`);
    for (const f of p.findings) {
      lines.push(`    - ${sevColor[f.severity](f.severity)}  ${f.rule}: ${f.message}`);
    }
  }
  return lines.join("\n");
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatPackage(p: PackageRisk): string {
  const lines: string[] = [];
  lines.push(`${sevColor[p.worstSeverity](p.worstSeverity.toUpperCase())}  ${pc.bold(p.name)}@${p.version}  score=${p.totalScore}`);
  for (const f of p.findings) {
    lines.push(`  - ${sevColor[f.severity](f.severity)}  ${f.rule}: ${f.message}`);
  }
  return lines.join("\n");
}
