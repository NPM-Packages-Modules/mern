export type SchemaResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface Schema<T> {
  parse(input: unknown, path?: string): SchemaResult<T>;
  describe(): SchemaDescriptor;
  readonly _type?: T;
}

export type SchemaDescriptor =
  | { type: "string"; min?: number; max?: number; pattern?: string; format?: "email" | "uuid" | "url" }
  | { type: "number"; min?: number; max?: number; integer?: boolean }
  | { type: "boolean" }
  | { type: "literal"; value: string | number | boolean }
  | { type: "enum"; values: string[] }
  | { type: "array"; items: SchemaDescriptor; min?: number; max?: number }
  | { type: "object"; properties: Record<string, SchemaDescriptor>; required: string[] }
  | { type: "unknown" }
  | { type: "null" }
  | { type: "optional"; inner: SchemaDescriptor }
  | { type: "union"; options: SchemaDescriptor[] };

function ok<T>(data: T): SchemaResult<T> {
  return { success: true, data };
}
function fail(message: string, path?: string): SchemaResult<never> {
  return { success: false, error: path ? `${path}: ${message}` : message };
}

export interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: "email" | "uuid" | "url";
}

export function string(options: StringOptions = {}): Schema<string> {
  return {
    parse(input, path) {
      if (typeof input !== "string") return fail("expected string", path);
      if (options.min !== undefined && input.length < options.min) return fail(`min length ${options.min}`, path);
      if (options.max !== undefined && input.length > options.max) return fail(`max length ${options.max}`, path);
      if (options.pattern && !options.pattern.test(input)) return fail(`does not match ${options.pattern}`, path);
      if (options.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return fail("invalid email", path);
      if (options.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) return fail("invalid uuid", path);
      if (options.format === "url") {
        try { new URL(input); } catch { return fail("invalid url", path); }
      }
      return ok(input);
    },
    describe() {
      const out: SchemaDescriptor = { type: "string" };
      if (options.min !== undefined) (out as { min: number }).min = options.min;
      if (options.max !== undefined) (out as { max: number }).max = options.max;
      if (options.pattern) (out as { pattern: string }).pattern = options.pattern.source;
      if (options.format) (out as { format: NonNullable<StringOptions["format"]> }).format = options.format;
      return out;
    },
  };
}

export interface NumberOptions { min?: number; max?: number; integer?: boolean }

export function number(options: NumberOptions = {}): Schema<number> {
  return {
    parse(input, path) {
      const value = typeof input === "string" ? Number(input) : input;
      if (typeof value !== "number" || !Number.isFinite(value)) return fail("expected number", path);
      if (options.integer && !Number.isInteger(value)) return fail("expected integer", path);
      if (options.min !== undefined && value < options.min) return fail(`min ${options.min}`, path);
      if (options.max !== undefined && value > options.max) return fail(`max ${options.max}`, path);
      return ok(value);
    },
    describe() {
      const out: SchemaDescriptor = { type: "number" };
      if (options.min !== undefined) (out as { min: number }).min = options.min;
      if (options.max !== undefined) (out as { max: number }).max = options.max;
      if (options.integer) (out as { integer: boolean }).integer = true;
      return out;
    },
  };
}

export function boolean(): Schema<boolean> {
  return {
    parse(input, path) {
      if (typeof input === "boolean") return ok(input);
      if (input === "true") return ok(true);
      if (input === "false") return ok(false);
      return fail("expected boolean", path);
    },
    describe() {
      return { type: "boolean" };
    },
  };
}

export function literal<T extends string | number | boolean>(value: T): Schema<T> {
  return {
    parse(input, path) {
      return input === value ? ok(value) : fail(`expected ${JSON.stringify(value)}`, path);
    },
    describe() { return { type: "literal", value: value as string | number | boolean }; },
  };
}

export function enums<T extends string>(values: readonly T[]): Schema<T> {
  return {
    parse(input, path) {
      if (typeof input !== "string") return fail("expected string", path);
      if (!values.includes(input as T)) return fail(`expected one of [${values.join(", ")}]`, path);
      return ok(input as T);
    },
    describe() { return { type: "enum", values: [...values] }; },
  };
}

export function array<T>(item: Schema<T>, options: { min?: number; max?: number } = {}): Schema<T[]> {
  return {
    parse(input, path) {
      if (!Array.isArray(input)) return fail("expected array", path);
      if (options.min !== undefined && input.length < options.min) return fail(`min length ${options.min}`, path);
      if (options.max !== undefined && input.length > options.max) return fail(`max length ${options.max}`, path);
      const out: T[] = [];
      for (let i = 0; i < input.length; i++) {
        const r = item.parse(input[i], `${path ?? ""}[${i}]`);
        if (!r.success) return r;
        out.push(r.data);
      }
      return ok(out);
    },
    describe() {
      const out: SchemaDescriptor = { type: "array", items: item.describe() };
      if (options.min !== undefined) (out as { min: number }).min = options.min;
      if (options.max !== undefined) (out as { max: number }).max = options.max;
      return out;
    },
  };
}

export function optional<T>(inner: Schema<T>): Schema<T | undefined> {
  return {
    parse(input, path) {
      if (input === undefined || input === null) return ok(undefined);
      return inner.parse(input, path);
    },
    describe() { return { type: "optional", inner: inner.describe() }; },
  };
}

export type ObjectShape = Record<string, Schema<unknown>>;
export type InferShape<S extends ObjectShape> = { [K in keyof S]: S[K] extends Schema<infer T> ? T : never };

export function object<S extends ObjectShape>(shape: S, options: { strict?: boolean } = {}): Schema<InferShape<S>> {
  const required = Object.entries(shape)
    .filter(([, s]) => s.describe().type !== "optional")
    .map(([k]) => k);

  return {
    parse(input, path) {
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return fail("expected object", path);
      }
      const source = input as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(shape)) {
        const r = schema.parse(source[key], path ? `${path}.${key}` : key);
        if (!r.success) return r as SchemaResult<never>;
        if (r.data !== undefined) out[key] = r.data;
      }
      if (options.strict) {
        for (const k of Object.keys(source)) {
          if (!(k in shape)) return fail(`unexpected key ${k}`, path);
        }
      }
      return ok(out as InferShape<S>);
    },
    describe() {
      const properties: Record<string, SchemaDescriptor> = {};
      for (const [k, s] of Object.entries(shape)) properties[k] = s.describe();
      return { type: "object", properties, required };
    },
  };
}

export function unknown(): Schema<unknown> {
  return {
    parse(input) { return ok(input); },
    describe() { return { type: "unknown" }; },
  };
}

export function union<T extends [Schema<unknown>, Schema<unknown>, ...Schema<unknown>[]]>(
  options: T,
): Schema<T[number] extends Schema<infer U> ? U : never> {
  return {
    parse(input, path) {
      const errors: string[] = [];
      for (const o of options) {
        const r = o.parse(input, path);
        if (r.success) return r as SchemaResult<T[number] extends Schema<infer U> ? U : never>;
        errors.push(r.error);
      }
      return fail(`union: ${errors.join(" | ")}`, path);
    },
    describe() {
      return { type: "union", options: options.map((o) => o.describe()) };
    },
  };
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

export const t = { string, number, boolean, literal, enums, array, object, optional, unknown, union };
