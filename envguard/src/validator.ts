import { EnvValidationError } from "./rules.js";
import type { EnvSource, Infer, Schema, ValidationIssue, ValidationResult } from "./types.js";

export interface ValidateOptions {
  source?: EnvSource;
  throwOnError?: boolean;
}

export function validate<S extends Schema>(
  schema: S,
  options: ValidateOptions = {},
): ValidationResult<Infer<S>> {
  const source = options.source ?? (process.env as EnvSource);
  const issues: ValidationIssue[] = [];
  const data: Record<string, unknown> = {};

  for (const [key, rule] of Object.entries(schema)) {
    const raw = source[key];
    try {
      data[key] = rule.parse(raw, key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const kind: ValidationIssue["kind"] = /^Missing required/.test(message) ? "missing" : "invalid";
      issues.push({ key, message, kind });
      data[key] = rule.default;
    }
  }

  const ok = issues.length === 0;
  if (!ok && options.throwOnError) {
    throw new EnvValidationError(formatIssues(issues));
  }
  return { ok, data: data as Infer<S>, issues };
}

export function loadEnv<S extends Schema>(schema: S, options: ValidateOptions = {}): Infer<S> {
  const { ok, data, issues } = validate(schema, { ...options, throwOnError: false });
  if (!ok) {
    throw new EnvValidationError(formatIssues(issues));
  }
  return data;
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "No issues";
  return issues.map((i) => `  - [${i.kind}] ${i.key}: ${i.message}`).join("\n");
}

export function explainSchema<S extends Schema>(schema: S): Array<{
  key: string;
  kind: string;
  required: boolean;
  description?: string;
  secret?: boolean;
  default?: unknown;
}> {
  return Object.entries(schema).map(([key, rule]) => ({
    key,
    kind: rule.kind,
    required: rule.required,
    description: rule.description,
    secret: rule.secret,
    default: rule.default,
  }));
}
