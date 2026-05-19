export type RiskLevel = "info" | "low" | "medium" | "high" | "critical";

export interface Finding {
  rule: string;
  severity: RiskLevel;
  message: string;
  score: number;
}

export interface PackageRisk {
  name: string;
  version: string;
  worstSeverity: RiskLevel;
  totalScore: number;
  findings: Finding[];
}

export interface ScanResult {
  packages: PackageRisk[];
  scannedAt: string;
  generatedAt: string;
  totalPackages: number;
}

export interface ScanOptions {
  cwd?: string;
  failOn?: RiskLevel;
  format?: "pretty" | "json";
  ignore?: string[];
  cacheTTL?: number;
  scanDepth?: "direct" | "all";
  network?: boolean;
}
