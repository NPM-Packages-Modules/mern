export { scan, planFix, applyFix } from "./scan.js";
export { formatPretty, formatJson } from "./format.js";
export { loadConfig } from "./config.js";
export { loadWorkspaces, detectWorkspaces, readDriftIgnore } from "./workspace.js";
export { severity, highestRange, maxSeverity, SEVERITY_RANK, extractVersion } from "./semver.js";
export type {
  DriftReport,
  DriftedDependency,
  WorkspacePackage,
  ScanOptions,
  Severity,
  DepField,
} from "./types.js";
export type { FixPlan } from "./scan.js";
