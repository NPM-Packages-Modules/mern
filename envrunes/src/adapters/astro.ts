import { createEnv as createEnvCore } from "../core.js";
import type {
  CreateEnvOptions,
  Env,
  ZodRecord,
} from "../core.js";

export type AstroEnvOptions<
  TServer extends ZodRecord,
  TClient extends ZodRecord,
> = Omit<CreateEnvOptions<TServer, TClient>, "clientPrefix" | "isServer">;

export function createEnv<
  TServer extends ZodRecord = {},
  TClient extends ZodRecord = {},
>(opts: AstroEnvOptions<TServer, TClient>): Env<TServer, TClient> {
  return createEnvCore({
    ...opts,
    clientPrefix: "PUBLIC_",
    isServer: typeof window === "undefined",
  });
}

export { EnvValidationError, InvalidAccessError } from "../errors.js";
export type { InvalidVar } from "../errors.js";
