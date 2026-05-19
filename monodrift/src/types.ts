export type Severity = "patch" | "minor" | "major";
export type DepField = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";

export interface WorkspacePackage {
  name: string;
  version: string;
  packageJsonPath: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
}

export interface DriftedDependency {
  name: string;
  severity: Severity;
  versions: { workspace: string; version: string; field: DepField; path: string }[];
}

export interface DriftReport {
  workspaces: WorkspacePackage[];
  drifted: DriftedDependency[];
  generatedAt: string;
}

export interface ScanOptions {
  cwd?: string;
  ignore?: string[];
  failOn?: Severity;
  workspaceGlobs?: string[];
}
