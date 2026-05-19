import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold, TEMPLATES } from "../src/index.js";

function withTmpDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "mcp-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("scaffold", () => {
  it("creates a blank TypeScript MCP server", () => {
    withTmpDir((dir) => {
      const target = join(dir, "my-mcp");
      scaffold({
        name: "my-mcp",
        template: "blank",
        transport: "stdio",
        language: "typescript",
        auth: false,
        target,
      });
      expect(existsSync(join(target, "package.json"))).toBe(true);
      expect(existsSync(join(target, "src/index.ts"))).toBe(true);
      const idx = readFileSync(join(target, "src/index.ts"), "utf8");
      expect(idx).toContain("StdioServerTransport");
      expect(idx).toContain("echo");
    });
  });

  it("creates a postgres server with required env vars", () => {
    withTmpDir((dir) => {
      const target = join(dir, "pg-mcp");
      scaffold({
        name: "pg-mcp",
        template: "postgres",
        transport: "stdio",
        language: "typescript",
        auth: true,
        target,
      });
      const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as { dependencies: Record<string, string> };
      expect(pkg.dependencies.pg).toBeDefined();
      const env = readFileSync(join(target, ".env.example"), "utf8");
      expect(env).toMatch(/DATABASE_URL/);
      const idx = readFileSync(join(target, "src/index.ts"), "utf8");
      expect(idx).toContain("requireAuth");
    });
  });

  it("refuses to overwrite a non-empty directory", () => {
    withTmpDir((dir) => {
      const target = join(dir, "x");
      scaffold({
        name: "x",
        template: "blank",
        transport: "stdio",
        language: "javascript",
        auth: false,
        target,
      });
      expect(() => scaffold({
        name: "x",
        template: "blank",
        transport: "stdio",
        language: "javascript",
        auth: false,
        target,
      })).toThrow(/not empty/);
    });
  });

  it("registers all 5 templates", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(["blank", "filesystem", "postgres", "rest", "stripe"]);
  });
});
