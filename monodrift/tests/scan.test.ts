import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan, planFix, applyFix } from "../src/index.js";
import { severity, highestRange } from "../src/semver.js";

function withMonorepo<T>(setup: (root: string) => void, fn: (root: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "drift-"));
  try {
    setup(dir);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("severity", () => {
  it("computes major/minor/patch correctly", () => {
    expect(severity("1.0.0", "2.0.0")).toBe("major");
    expect(severity("1.1.0", "1.2.0")).toBe("minor");
    expect(severity("1.1.1", "1.1.2")).toBe("patch");
    expect(severity("^1.0.0", "~1.0.0")).toBe("patch");
    expect(severity("1.0.0", "1.0.0")).toBe("none");
  });
});

describe("highestRange", () => {
  it("returns the highest semver", () => {
    expect(highestRange(["^18.2.0", "^18.3.1", "^17.0.2"])).toBe("^18.3.1");
  });
});

describe("scan + fix", () => {
  it("detects drift across workspaces and applies a fix", () => {
    withMonorepo(
      (root) => {
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }, null, 2));
        mkdirSync(join(root, "packages/a"), { recursive: true });
        mkdirSync(join(root, "packages/b"), { recursive: true });
        writeFileSync(
          join(root, "packages/a/package.json"),
          JSON.stringify({ name: "a", version: "1.0.0", dependencies: { react: "^18.2.0" } }, null, 2),
        );
        writeFileSync(
          join(root, "packages/b/package.json"),
          JSON.stringify({ name: "b", version: "1.0.0", dependencies: { react: "^18.3.1" } }, null, 2),
        );
      },
      (root) => {
        const report = scan({ cwd: root });
        expect(report.drifted).toHaveLength(1);
        expect(report.drifted[0]!.name).toBe("react");
        expect(report.drifted[0]!.severity).toBe("minor");

        const plan = planFix(report);
        expect(plan.changes).toHaveLength(1);
        applyFix(plan);

        const a = JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf8"));
        const b = JSON.parse(readFileSync(join(root, "packages/b/package.json"), "utf8"));
        expect(a.dependencies.react).toBe("^18.3.1");
        expect(b.dependencies.react).toBe("^18.3.1");
      },
    );
  });

  it("respects .driftignore", () => {
    withMonorepo(
      (root) => {
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }, null, 2));
        writeFileSync(join(root, ".driftignore"), "react\n");
        mkdirSync(join(root, "packages/a"), { recursive: true });
        mkdirSync(join(root, "packages/b"), { recursive: true });
        writeFileSync(
          join(root, "packages/a/package.json"),
          JSON.stringify({ name: "a", version: "1.0.0", dependencies: { react: "1.0.0" } }, null, 2),
        );
        writeFileSync(
          join(root, "packages/b/package.json"),
          JSON.stringify({ name: "b", version: "1.0.0", dependencies: { react: "2.0.0" } }, null, 2),
        );
      },
      (root) => {
        const report = scan({ cwd: root });
        expect(report.drifted).toHaveLength(0);
      },
    );
  });
});
