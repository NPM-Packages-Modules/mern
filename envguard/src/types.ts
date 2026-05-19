export type EnvSourceValue = string | undefined;

export type EnvSource = Record<string, EnvSourceValue>;

export type RuleKind = "string" | "number" | "boolean" | "url" | "email" | "enum" | "json" | "port";

export interface BaseRule<T> {
  kind: RuleKind;
  required: boolean;
  default?: T;
  description?: string;
  secret?: boolean;
  parse: (raw: string | undefined, key: string) => T;
}

export interface StringRuleOptions {
  required?: boolean;
  default?: string;
  description?: string;
  secret?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export interface NumberRuleOptions {
  required?: boolean;
  default?: number;
  description?: string;
  min?: number;
  max?: number;
  integer?: boolean;
}

export interface BooleanRuleOptions {
  required?: boolean;
  default?: boolean;
  description?: string;
}

export interface UrlRuleOptions {
  required?: boolean;
  default?: string;
  description?: string;
  protocols?: string[];
}

export interface EnumRuleOptions<T extends string> {
  required?: boolean;
  default?: T;
  description?: string;
  values: readonly T[];
}

export interface JsonRuleOptions<T> {
  required?: boolean;
  default?: T;
  description?: string;
}

export interface PortRuleOptions {
  required?: boolean;
  default?: number;
  description?: string;
}

export type Schema = Record<string, BaseRule<unknown>>;

export type Infer<S extends Schema> = {
  [K in keyof S]: S[K] extends BaseRule<infer T> ? T : never;
};

export interface ValidationIssue {
  key: string;
  message: string;
  kind: "missing" | "invalid";
}

export interface ValidationResult<T> {
  ok: boolean;
  data: T;
  issues: ValidationIssue[];
}
