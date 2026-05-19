import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  audit,
  buildGraph,
  buildModuleInfo,
  computeScore,
  countLOC,
  extractExports,
  extractImports,
  findCycles,
  scanForSecrets,
  scoreToGrade,
} from "../src/index.js";

describe("parse helpers", () => {
  it("extracts ESM and CJS imports", () => {
    const code = `
      import a from "./a";
      import { b } from './b';
      export { c } from './c';
      const x = require("./x");
      import("./dyn");
    `;
    const imports = extractImports(code);
    expect(imports.sort()).toEqual(["./a", "./b", "./c", "./dyn", "./x"]);
  });

  it("extracts exports + default flag", () => {
    const code = `
      export const foo = 1;
      export class Bar {}
      export default function () {}
      export { x, y as z };
    `;
    const { exports, hasDefault } = extractExports(code);
    expect(exports.sort()).toEqual(["Bar", "foo", "x", "y"]);
    expect(hasDefault).toBe(true);
  });

  it("counts non-empty non-comment LOC", () => {
    expect(countLOC("a\n\n// comment\nb")).toBe(2);
  });
});

describe("graph cycle detection", () => {
  it("detects a 2-cycle", () => {
    const dir = mkdtempSync(join(tmpdir(), "archsense-cy-"));
    try {
      writeFileSync(join(dir, "a.ts"), `import "./b";`);
      writeFileSync(join(dir, "b.ts"), `import "./a";`);
      const modules = [
        buildModuleInfo(join(dir, "a.ts"), `import "./b";`),
        buildModuleInfo(join(dir, "b.ts"), `import "./a";`),
      ];
      const graph = buildGraph(modules, dir);
      const cycles = findCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("secret scanner", () => {
  it("detects AWS keys", () => {
    const out = scanForSecrets("const k = 'AKIAABCDEFGHIJKLMNOP'");
    expect(out).toContain("AWS Access Key");
  });
  it("ignores benign text", () => {
    expect(scanForSecrets("const k = 'hello'")).toEqual([]);
  });
});

describe("scoring", () => {
  it("gives 100 for empty", () => {
    expect(computeScore([], 0)).toBe(100);
  });
  it("penalizes errors more than warnings", () => {
    const errScore = computeScore([{ kind: "leaked-secret", severity: "error", message: "", files: [] }], 1);
    const warnScore = computeScore([{ kind: "oversized-file", severity: "warn", message: "", files: [] }], 1);
    expect(errScore).toBeLessThan(warnScore);
  });
  it("scoreToGrade follows thresholds", () => {
    expect(scoreToGrade(95)).toBe("A");
    expect(scoreToGrade(85)).toBe("B");
    expect(scoreToGrade(75)).toBe("C");
    expect(scoreToGrade(65)).toBe("D");
    expect(scoreToGrade(40)).toBe("F");
  });
});

describe("end-to-end audit", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "archsense-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("scans files and produces a report", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), `import "./b";\nexport const a = 1;`);
    writeFileSync(join(dir, "src", "b.ts"), `import "./a";\nexport const b = 2;`);
    const bigLines = Array.from({ length: 600 }, (_, i) => `export const v${i} = ${i};`).join("\n");
    writeFileSync(join(dir, "src", "big.ts"), bigLines);
    const report = audit({ rootDir: dir });
    expect(report.filesScanned).toBeGreaterThanOrEqual(3);
    expect(report.findings.some((f) => f.kind === "circular-dependency")).toBe(true);
    expect(report.findings.some((f) => f.kind === "oversized-file")).toBe(true);
    expect(report.score).toBeLessThan(100);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
  });

  it("flags leaked secrets", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "leak.ts"), `export const k = 'AKIAABCDEFGHIJKLMNOP';`);
    const report = audit({ rootDir: dir });
    expect(report.findings.some((f) => f.kind === "leaked-secret")).toBe(true);
  });

  it("flags duplicate filenames", () => {
    mkdirSync(join(dir, "src", "x"), { recursive: true });
    mkdirSync(join(dir, "src", "y"), { recursive: true });
    writeFileSync(join(dir, "src", "x", "user.ts"), "export const a = 1;");
    writeFileSync(join(dir, "src", "y", "user.ts"), "export const b = 1;");
    const report = audit({ rootDir: dir });
    expect(report.findings.some((f) => f.kind === "duplicate-filename")).toBe(true);
  });
});
