export { scan, audit } from "./scanner.js";
export { formatReport, formatJson, formatPackage } from "./format.js";
export { loadConfig } from "./config.js";
export {
  scoreInstallScript,
  findTyposquatCandidate,
  levenshtein,
  maxSeverity,
  severityAtLeast,
} from "./scoring.js";
export { TOP_PACKAGES } from "./top-packages.js";
export type {
  ScanResult,
  ScanOptions,
  PackageRisk,
  Finding,
  RiskLevel,
} from "./types.js";
