export type FindingKind =
  | "circular-dependency"
  | "oversized-file"
  | "deep-nesting"
  | "god-folder"
  | "unused-export"
  | "duplicate-filename"
  | "missing-tests"
  | "leaked-secret"
  | "wildcard-imports"
  | "high-fan-in"
  | "high-fan-out";

export type Severity = "info" | "warn" | "error";

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  message: string;
  suggestion?: string;
  files: string[];
}

export interface ModuleInfo {
  file: string;
  loc: number;
  imports: string[];
  exports: string[];
  hasDefaultExport: boolean;
}

export interface DependencyGraph {
  modules: Map<string, ModuleInfo>;
  edges: Map<string, Set<string>>;
}

export interface AuditReport {
  rootDir: string;
  filesScanned: number;
  totalLOC: number;
  findings: Finding[];
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  graph: { nodes: number; edges: number; cycles: string[] };
}

export interface AuditOptions {
  rootDir: string;
  include?: string[];
  ignore?: string[];
  maxFileLOC?: number;
  godFolderThreshold?: number;
  highFanOut?: number;
  highFanIn?: number;
  deepNestingThreshold?: number;
  enableSecretScan?: boolean;
}
