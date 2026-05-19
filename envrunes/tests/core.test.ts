import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createEnv, EnvValidationError, InvalidAccessError } from "../src/index.js";

describe("envy core", () => {
  it("validates a happy path env", () => {
    const env = createEnv({
      server: {
        DATABASE_URL: z.string().url(),
        PORT: z.coerce.number(),
        DEBUG: z.coerce.boolean().default(false),
      },
      runtimeEnv: {
        DATABASE_URL: "postgres://localhost/db",
        PORT: "3000",
      },
    });
    expect(env.DATABASE_URL).toBe("postgres://localhost/db");
    expect(env.PORT).toBe(3000);
    expect(env.DEBUG).toBe(false);
  });

  it("collects ALL invalid vars and throws once", () => {
    expect(() =>
      createEnv({
        server: {
          DATABASE_URL: z.string().url(),
          PORT: z.coerce.number(),
          API_KEY: z.string().min(10),
        },
        runtimeEnv: {
          DATABASE_URL: "not-a-url",
          API_KEY: "short",
        },
      }),
    ).toThrowError(EnvValidationError);
  });

  it("error contains every issue", () => {
    try {
      createEnv({
        server: {
          A: z.string().url(),
          B: z.coerce.number(),
        },
        runtimeEnv: { A: "x", B: "y" },
      });
    } catch (e) {
      const err = e as EnvValidationError;
      expect(err.invalid).toHaveLength(2);
      expect(err.message).toMatch(/A:/);
      expect(err.message).toMatch(/B:/);
    }
  });

  it("applies defaults so inferred type contains the value", () => {
    const env = createEnv({
      server: { PORT: z.coerce.number().default(3000) },
      runtimeEnv: {},
    });
    expect(env.PORT).toBe(3000);
  });

  it("treats empty strings as missing", () => {
    const env = createEnv({
      server: { OPTIONAL: z.string().optional() },
      runtimeEnv: { OPTIONAL: "" },
    });
    expect(env.OPTIONAL).toBeUndefined();
  });

  it("supports skipValidation", () => {
    const env = createEnv({
      server: { REQUIRED: z.string() },
      runtimeEnv: {},
      skipValidation: true,
    });
    expect(env.REQUIRED).toBeUndefined();
  });

  it("calls onValidationError instead of throwing", () => {
    const hook = vi.fn();
    createEnv({
      server: { REQUIRED: z.string() },
      runtimeEnv: {},
      onValidationError: hook,
    });
    expect(hook).toHaveBeenCalledOnce();
    expect(hook.mock.calls[0]![0]).toBeInstanceOf(EnvValidationError);
  });

  it("enforces clientPrefix on client vars", () => {
    expect(() =>
      createEnv({
        client: { BAD_VAR: z.string() },
        clientPrefix: "NEXT_PUBLIC_",
        runtimeEnv: {},
      }),
    ).toThrow(/must start with prefix/);
  });

  it("forbids client prefix on server vars", () => {
    expect(() =>
      createEnv({
        server: { NEXT_PUBLIC_LEAK: z.string() },
        clientPrefix: "NEXT_PUBLIC_",
        runtimeEnv: { NEXT_PUBLIC_LEAK: "x" },
      }),
    ).toThrow(/NOT start with the client prefix/);
  });

  it("throws InvalidAccessError when reading server var on client", () => {
    const env = createEnv({
      server: { SECRET: z.string() },
      client: { NEXT_PUBLIC_X: z.string() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: { SECRET: "shh", NEXT_PUBLIC_X: "ok" },
      isServer: false,
    });
    expect(env.NEXT_PUBLIC_X).toBe("ok");
    expect(() => env.SECRET).toThrow(InvalidAccessError);
  });

  it("returns frozen-ish proxy that disallows writes", () => {
    const env = createEnv({
      server: { A: z.string().default("a") },
      runtimeEnv: {},
    });
    expect(() => {
      (env as unknown as Record<string, string>).A = "b";
    }).toThrow();
  });
});
