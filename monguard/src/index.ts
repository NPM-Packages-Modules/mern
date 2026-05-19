export { monguard, applyGlobally } from "./plugin.js";
export { Analyzer } from "./analyzer.js";
export { formatWarning, formatStats } from "./format.js";
export {
  extractFilterFields,
  fingerprintFilter,
  fingerprintQuery,
} from "./keys.js";
export {
  isFieldIndexed,
  indexCoversFields,
  unindexedFields,
  suggestCompoundIndex,
  isFullScan,
} from "./index-analysis.js";
export type {
  MonguardOptions,
  MonguardReporter,
  MonguardStats,
  QueryEvent,
  SchemaIndexSpec,
  Warning,
  WarningKind,
} from "./types.js";
