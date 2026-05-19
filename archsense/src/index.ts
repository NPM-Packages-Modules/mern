export { audit, computeScore, scoreToGrade } from "./auditor.js";
export { buildGraph, findCycles, fanIn, fanOut } from "./graph.js";
export { walkFiles, readFile, relativeFrom, topFolderOf } from "./fs.js";
export {
  extractImports,
  extractExports,
  countLOC,
  buildModuleInfo,
  resolveImport,
} from "./parse.js";
export { scanForSecrets } from "./secrets.js";
export { formatReport, reportToJson } from "./format.js";
export type {
  AuditOptions,
  AuditReport,
  Finding,
  FindingKind,
  ModuleInfo,
  DependencyGraph,
  Severity,
} from "./types.js";
