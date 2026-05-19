import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkPackageFootprint, parseEnvExampleKeys } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("deployguard", () => {
  it("parseEnvExampleKeys", () => {
    expect(parseEnvExampleKeys("FOO=1\n#c\nBAR=x\n")).toEqual(["FOO", "BAR"]);
  });

  it("checkPackageFootprint self", async () => {
    const r = await checkPackageFootprint(resolve(here, ".."));
    expect(r.name).toBe("deps-weight");
    expect(r.ok).toBe(true);
  });
});
