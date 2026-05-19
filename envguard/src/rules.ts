import type {
  BaseRule,
  BooleanRuleOptions,
  EnumRuleOptions,
  JsonRuleOptions,
  NumberRuleOptions,
  PortRuleOptions,
  StringRuleOptions,
  UrlRuleOptions,
} from "./types.js";

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

function takeValue(raw: string | undefined, fallback: unknown, required: boolean, key: string): string {
  if (raw === undefined || raw === "") {
    if (fallback !== undefined) return String(fallback);
    if (required) throw new EnvValidationError(`Missing required env var "${key}"`);
    return "";
  }
  return raw;
}

export function string(options: StringRuleOptions = {}): BaseRule<string> {
  const { required = true, min, max, pattern, default: def } = options;
  return {
    kind: "string",
    required,
    default: def,
    description: options.description,
    secret: options.secret,
    parse(raw, key) {
      if ((raw === undefined || raw === "") && def === undefined && !required) {
        return "";
      }
      const value = takeValue(raw, def, required, key);
      if (min !== undefined && value.length < min) {
        throw new EnvValidationError(`"${key}" must be at least ${min} chars (got ${value.length})`);
      }
      if (max !== undefined && value.length > max) {
        throw new EnvValidationError(`"${key}" must be at most ${max} chars (got ${value.length})`);
      }
      if (pattern && !pattern.test(value)) {
        throw new EnvValidationError(`"${key}" does not match pattern ${pattern}`);
      }
      return value;
    },
  };
}

export function number(options: NumberRuleOptions = {}): BaseRule<number> {
  const { required = true, min, max, integer = false, default: def } = options;
  return {
    kind: "number",
    required,
    default: def,
    description: options.description,
    parse(raw, key) {
      const value = takeValue(raw, def, required, key);
      if (value === "" && !required) return 0;
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new EnvValidationError(`"${key}" must be a finite number (got "${value}")`);
      }
      if (integer && !Number.isInteger(n)) {
        throw new EnvValidationError(`"${key}" must be an integer (got ${n})`);
      }
      if (min !== undefined && n < min) {
        throw new EnvValidationError(`"${key}" must be >= ${min} (got ${n})`);
      }
      if (max !== undefined && n > max) {
        throw new EnvValidationError(`"${key}" must be <= ${max} (got ${n})`);
      }
      return n;
    },
  };
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "y", "t"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "n", "f"]);

export function boolean(options: BooleanRuleOptions = {}): BaseRule<boolean> {
  const { required = true, default: def } = options;
  return {
    kind: "boolean",
    required,
    default: def,
    description: options.description,
    parse(raw, key) {
      if ((raw === undefined || raw === "") && def !== undefined) return def;
      if ((raw === undefined || raw === "") && !required) return false;
      if (raw === undefined || raw === "") {
        throw new EnvValidationError(`Missing required env var "${key}"`);
      }
      const lower = raw.toLowerCase();
      if (TRUE_VALUES.has(lower)) return true;
      if (FALSE_VALUES.has(lower)) return false;
      throw new EnvValidationError(`"${key}" must be a boolean (true/false/1/0/yes/no), got "${raw}"`);
    },
  };
}

export function url(options: UrlRuleOptions = {}): BaseRule<string> {
  const { required = true, default: def, protocols } = options;
  return {
    kind: "url",
    required,
    default: def,
    description: options.description,
    parse(raw, key) {
      const value = takeValue(raw, def, required, key);
      if (value === "" && !required) return "";
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        throw new EnvValidationError(`"${key}" must be a valid URL (got "${value}")`);
      }
      if (protocols && protocols.length > 0) {
        const proto = parsed.protocol.replace(/:$/, "");
        if (!protocols.includes(proto)) {
          throw new EnvValidationError(
            `"${key}" must use protocol ${protocols.join("/")} (got "${proto}")`,
          );
        }
      }
      return parsed.toString();
    },
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function email(options: StringRuleOptions = {}): BaseRule<string> {
  const base = string(options);
  return {
    ...base,
    kind: "email",
    parse(raw, key) {
      const value = base.parse(raw, key);
      if (value === "" && !base.required) return "";
      if (!EMAIL_REGEX.test(value)) {
        throw new EnvValidationError(`"${key}" must be a valid email (got "${value}")`);
      }
      return value;
    },
  };
}

export function enums<T extends string>(options: EnumRuleOptions<T>): BaseRule<T> {
  const { required = true, default: def, values } = options;
  return {
    kind: "enum",
    required,
    default: def,
    description: options.description,
    parse(raw, key) {
      const value = takeValue(raw, def, required, key);
      if (value === "" && !required) return "" as T;
      if (!values.includes(value as T)) {
        throw new EnvValidationError(
          `"${key}" must be one of [${values.join(", ")}] (got "${value}")`,
        );
      }
      return value as T;
    },
  };
}

export function json<T = unknown>(options: JsonRuleOptions<T> = {}): BaseRule<T> {
  const { required = true, default: def } = options;
  return {
    kind: "json",
    required,
    default: def,
    description: options.description,
    parse(raw, key): T {
      if ((raw === undefined || raw === "") && def !== undefined) return def;
      if ((raw === undefined || raw === "") && !required) return undefined as unknown as T;
      if (raw === undefined || raw === "") {
        throw new EnvValidationError(`Missing required env var "${key}"`);
      }
      try {
        return JSON.parse(raw) as T;
      } catch (err) {
        throw new EnvValidationError(`"${key}" must be valid JSON: ${(err as Error).message}`);
      }
    },
  };
}

export function port(options: PortRuleOptions = {}): BaseRule<number> {
  return number({
    required: options.required ?? true,
    default: options.default,
    description: options.description,
    integer: true,
    min: 1,
    max: 65535,
  });
}
