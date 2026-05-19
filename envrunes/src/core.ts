import type { ZodTypeAny, z } from "zod";
import { EnvValidationError, InvalidAccessError, type InvalidVar } from "./errors.js";

export type ZodRecord = Record<string, ZodTypeAny>;

export type InferRecord<T extends ZodRecord> = {
  [K in keyof T]: z.infer<T[K]>;
};

export interface CreateEnvOptions<
  TServer extends ZodRecord,
  TClient extends ZodRecord,
> {
  /** Schemas for server-only variables (never bundled to the client). */
  server?: TServer;
  /** Schemas for variables exposed to the client (must match a recognised prefix). */
  client?: TClient;
  /** Source of raw env values. Defaults to `process.env`. */
  runtimeEnv?: Record<string, string | undefined>;
  /** Required prefix for client-side variables (e.g. "NEXT_PUBLIC_"). */
  clientPrefix?: string;
  /** Bypass validation. Useful in test environments. */
  skipValidation?: boolean;
  /** Custom handler invoked when validation fails. Returning normally lets `process.exit(1)` or throw. */
  onValidationError?: (error: EnvValidationError) => never | void;
  /** Returns true when we are running on the client. Used to forbid access to server vars. */
  isServer?: boolean;
  /** Treat empty strings as missing values (default: true). */
  emptyStringAsUndefined?: boolean;
}

export type Env<TServer extends ZodRecord, TClient extends ZodRecord> = Readonly<
  InferRecord<TServer> & InferRecord<TClient>
>;

export type InferEnv<T> = T extends Readonly<infer U> ? U : T;

const DEFAULT_RUNTIME_ENV: Record<string, string | undefined> =
  typeof process !== "undefined" && process.env ? process.env : {};

function isServerDefault(): boolean {
  return typeof window === "undefined";
}

export function createEnv<
  TServer extends ZodRecord = {},
  TClient extends ZodRecord = {},
>(opts: CreateEnvOptions<TServer, TClient>): Env<TServer, TClient> {
  const {
    server = {} as TServer,
    client = {} as TClient,
    runtimeEnv = DEFAULT_RUNTIME_ENV,
    clientPrefix,
    skipValidation = false,
    onValidationError,
    isServer = isServerDefault(),
    emptyStringAsUndefined = true,
  } = opts;

  if (clientPrefix) {
    for (const key of Object.keys(client)) {
      if (!key.startsWith(clientPrefix)) {
        throw new Error(
          `Client variable "${key}" must start with prefix "${clientPrefix}".`,
        );
      }
    }
    for (const key of Object.keys(server)) {
      if (key.startsWith(clientPrefix)) {
        throw new Error(
          `Server variable "${key}" must NOT start with the client prefix "${clientPrefix}".`,
        );
      }
    }
  }

  const parsed: Record<string, unknown> = {};
  const invalid: InvalidVar[] = [];

  const validate = (name: string, schema: ZodTypeAny) => {
    let raw = runtimeEnv[name];
    if (emptyStringAsUndefined && raw === "") raw = undefined;
    const result = schema.safeParse(raw);
    if (result.success) {
      parsed[name] = result.data;
    } else {
      invalid.push({ name, received: raw, issues: result.error.issues });
    }
  };

  if (!skipValidation) {
    for (const [name, schema] of Object.entries(server)) validate(name, schema);
    for (const [name, schema] of Object.entries(client)) validate(name, schema);

    if (invalid.length > 0) {
      const err = new EnvValidationError(invalid);
      if (onValidationError) {
        onValidationError(err);
        return parsed as Env<TServer, TClient>;
      }
      throw err;
    }
  } else {
    for (const name of Object.keys(server)) parsed[name] = runtimeEnv[name];
    for (const name of Object.keys(client)) parsed[name] = runtimeEnv[name];
  }

  const serverKeys = new Set(Object.keys(server));

  const proxy = new Proxy(parsed, {
    get(target, prop) {
      if (typeof prop !== "string") return Reflect.get(target, prop);
      if (!isServer && serverKeys.has(prop)) {
        throw new InvalidAccessError(prop);
      }
      return target[prop];
    },
    set() {
      throw new Error("Env is read-only");
    },
    deleteProperty() {
      throw new Error("Env is read-only");
    },
  }) as Env<TServer, TClient>;

  return proxy;
}
