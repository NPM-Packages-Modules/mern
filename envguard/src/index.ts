export {
  string,
  number,
  boolean,
  url,
  email,
  enums,
  json,
  port,
  EnvValidationError,
} from "./rules.js";
export { validate, loadEnv, formatIssues, explainSchema } from "./validator.js";
export { parseDotEnv, loadDotEnv, mergeSources } from "./dotenv.js";
export type {
  Schema,
  Infer,
  BaseRule,
  ValidationIssue,
  ValidationResult,
  EnvSource,
  RuleKind,
} from "./types.js";

import * as rules from "./rules.js";
import { loadEnv, validate, explainSchema } from "./validator.js";
import type { Schema } from "./types.js";

export function envguard<S extends Schema>(schema: S, opts?: { throwOnError?: boolean }) {
  return loadEnv(schema, opts);
}

export const e = {
  string: rules.string,
  number: rules.number,
  boolean: rules.boolean,
  url: rules.url,
  email: rules.email,
  enums: rules.enums,
  json: rules.json,
  port: rules.port,
};

export const guard = {
  validate,
  load: loadEnv,
  explain: explainSchema,
};
