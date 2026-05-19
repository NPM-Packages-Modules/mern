import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findDuplicateSources, normalizeSourceLines } from "./index.js";

describe("codemorph", () => {
  it("normalizeSourceLines matches across whitespace", () => {
    const a = "  foo()\n  \n bar  ";
    const b = "foo()\nbar";
    expect(normalizeSourceLines(a)).toBe(normalizeSourceLines(b));
  });

  it("findDuplicateSources detects twins", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cm-"));
    try {
      const body = " export const x = 1 \n";
      await writeFile(path.join(dir, "a.ts"), body, "utf8");
      await writeFile(path.join(dir, "b.ts"), `  export const x = 1  \n`, "utf8");
      const dups = await findDuplicateSources(dir);
      expect(dups.length).toBe(1);
      expect(dups[0]!.files.length).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
