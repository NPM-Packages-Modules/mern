import { describe, expect, it } from "vitest";
import { validate, loadEnv } from "../src/validator.js";
import { string, number, boolean, url, email, enums, json, port, EnvValidationError } from "../src/rules.js";
import { parseDotEnv, mergeSources } from "../src/dotenv.js";

describe("string rule", () => {
  it("returns value when provided", () => {
    const { ok, data } = validate({ NAME: string() }, { source: { NAME: "alice" } });
    expect(ok).toBe(true);
    expect(data.NAME).toBe("alice");
  });

  it("fails when missing required", () => {
    const { ok, issues } = validate({ NAME: string() }, { source: {} });
    expect(ok).toBe(false);
    expect(issues[0]!.kind).toBe("missing");
  });

  it("supports defaults", () => {
    const { ok, data } = validate(
      { NAME: string({ default: "bob" }) },
      { source: {} },
    );
    expect(ok).toBe(true);
    expect(data.NAME).toBe("bob");
  });

  it("enforces min/max length", () => {
    const { ok, issues } = validate(
      { NAME: string({ min: 4 }) },
      { source: { NAME: "ab" } },
    );
    expect(ok).toBe(false);
    expect(issues[0]!.message).toMatch(/at least 4/);
  });

  it("enforces pattern", () => {
    const { ok } = validate(
      { CODE: string({ pattern: /^[A-Z]+$/ }) },
      { source: { CODE: "abc" } },
    );
    expect(ok).toBe(false);
  });
});

describe("number rule", () => {
  it("parses integers", () => {
    const { data } = validate({ PORT: number() }, { source: { PORT: "8080" } });
    expect(data.PORT).toBe(8080);
  });
  it("rejects non-numbers", () => {
    const { ok } = validate({ PORT: number() }, { source: { PORT: "abc" } });
    expect(ok).toBe(false);
  });
  it("respects min/max", () => {
    const r = validate({ N: number({ min: 1, max: 10 }) }, { source: { N: "100" } });
    expect(r.ok).toBe(false);
  });
});

describe("boolean rule", () => {
  it("parses true variants", () => {
    for (const v of ["true", "1", "yes", "ON"]) {
      const { data } = validate({ B: boolean() }, { source: { B: v } });
      expect(data.B).toBe(true);
    }
  });
  it("parses false variants", () => {
    for (const v of ["false", "0", "no", "OFF"]) {
      const { data } = validate({ B: boolean() }, { source: { B: v } });
      expect(data.B).toBe(false);
    }
  });
  it("rejects invalid", () => {
    const { ok } = validate({ B: boolean() }, { source: { B: "maybe" } });
    expect(ok).toBe(false);
  });
});

describe("url rule", () => {
  it("validates URLs", () => {
    const { data, ok } = validate({ U: url() }, { source: { U: "https://example.com" } });
    expect(ok).toBe(true);
    expect(data.U).toContain("example.com");
  });
  it("rejects bad URLs", () => {
    const { ok } = validate({ U: url() }, { source: { U: "not a url" } });
    expect(ok).toBe(false);
  });
  it("enforces protocols", () => {
    const { ok } = validate(
      { U: url({ protocols: ["https"] }) },
      { source: { U: "http://example.com" } },
    );
    expect(ok).toBe(false);
  });
});

describe("email rule", () => {
  it("accepts valid email", () => {
    const { ok } = validate({ E: email() }, { source: { E: "a@b.co" } });
    expect(ok).toBe(true);
  });
  it("rejects invalid email", () => {
    const { ok } = validate({ E: email() }, { source: { E: "nope" } });
    expect(ok).toBe(false);
  });
});

describe("enum rule", () => {
  it("accepts allowed values", () => {
    const { data } = validate(
      { MODE: enums({ values: ["dev", "prod"] as const }) },
      { source: { MODE: "dev" } },
    );
    expect(data.MODE).toBe("dev");
  });
  it("rejects unknown values", () => {
    const { ok } = validate(
      { MODE: enums({ values: ["dev", "prod"] as const }) },
      { source: { MODE: "qa" } },
    );
    expect(ok).toBe(false);
  });
});

describe("json rule", () => {
  it("parses JSON", () => {
    const { data } = validate(
      { CONF: json<{ a: number }>() },
      { source: { CONF: '{"a":1}' } },
    );
    expect(data.CONF).toEqual({ a: 1 });
  });
  it("rejects invalid JSON", () => {
    const { ok } = validate({ CONF: json() }, { source: { CONF: "{" } });
    expect(ok).toBe(false);
  });
});

describe("port rule", () => {
  it("enforces 1-65535 range", () => {
    expect(validate({ P: port() }, { source: { P: "0" } }).ok).toBe(false);
    expect(validate({ P: port() }, { source: { P: "70000" } }).ok).toBe(false);
    expect(validate({ P: port() }, { source: { P: "3000" } }).ok).toBe(true);
  });
});

describe("loadEnv", () => {
  it("throws when invalid", () => {
    expect(() => loadEnv({ X: string() }, { source: {} })).toThrow(EnvValidationError);
  });
  it("returns typed object", () => {
    const env = loadEnv(
      { NAME: string(), PORT: number() },
      { source: { NAME: "x", PORT: "1" } },
    );
    expect(env.NAME).toBe("x");
    expect(env.PORT).toBe(1);
  });
});

describe("dotenv parser", () => {
  it("parses key=value lines", () => {
    const s = parseDotEnv(`A=1\nB="two words"\n# comment\nC=hello`);
    expect(s).toEqual({ A: "1", B: "two words", C: "hello" });
  });
  it("merges sources with later winning", () => {
    expect(mergeSources({ A: "1", B: "2" }, { A: "9" })).toEqual({ A: "9", B: "2" });
  });
});
