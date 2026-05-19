#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { scan, planFix, applyFix } from "./scan.js";
import { formatJson, formatPretty } from "./format.js";
import { loadConfig } from "./config.js";
import { SEVERITY_RANK } from "./semver.js";
import type { Severity } from "./types.js";

const program = new Command();
program
  .name("drift-check")
  .description("Detect and fix dependency drift across workspaces")
  .option("--cwd <path>", "Working directory", process.cwd());

program
  .command("scan", { isDefault: true })
  .description("Scan workspaces and print a drift report")
  .option("--format <fmt>", "pretty | json", "pretty")
  .option("--fail-on <severity>", "patch | minor | major")
  .action((opts: { format: string; failOn?: string }) => {
    const cwd = (program.opts() as { cwd: string }).cwd;
    const cfg = loadConfig(cwd);
    const report = scan({
      cwd,
      ignore: cfg.ignore ?? [],
      ...(cfg.workspaceGlobs ? { workspaceGlobs: cfg.workspaceGlobs } : {}),
    });
    process.stdout.write(opts.format === "json" ? formatJson(report) : formatPretty(report));
    process.stdout.write("\n");
    const failOn = (opts.failOn ?? cfg.failOn) as Severity | undefined;
    if (failOn) {
      const hit = report.drifted.some((d) => SEVERITY_RANK[d.severity] >= SEVERITY_RANK[failOn]);
      if (hit) process.exit(1);
    }
  });

program
  .command("fix")
  .description("Bump drifted packages to a single version")
  .option("--target <target>", "Target version (e.g. 18.2.0) or 'latest' to pick the highest currently used", "latest")
  .option("--pkg <name>", "Limit to a single package name")
  .option("--dry-run", "Show planned changes without writing", false)
  .action((opts: { target: string; pkg?: string; dryRun: boolean }) => {
    const cwd = (program.opts() as { cwd: string }).cwd;
    const cfg = loadConfig(cwd);
    const report = scan({
      cwd,
      ignore: cfg.ignore ?? [],
      ...(cfg.workspaceGlobs ? { workspaceGlobs: cfg.workspaceGlobs } : {}),
    });
    const plan = planFix(report, {
      target: opts.target,
      ...(opts.pkg !== undefined ? { only: opts.pkg } : {}),
    });
    if (plan.changes.length === 0) {
      process.stdout.write("drift-check: nothing to fix\n");
      return;
    }
    for (const c of plan.changes) {
      process.stdout.write(`  ${c.name}: ${c.from} → ${c.to}   ${c.path}\n`);
    }
    if (opts.dryRun) {
      process.stdout.write("drift-check: dry-run, no files modified\n");
      return;
    }
    const result = applyFix(plan);
    process.stdout.write(`drift-check: updated ${result.filesChanged} file(s). Run your package manager's install.\n`);
  });

program
  .command("ignore <name>")
  .description("Append a package name to .driftignore")
  .action((name: string) => {
    const cwd = (program.opts() as { cwd: string }).cwd;
    const file = join(cwd, ".driftignore");
    const prefix = existsSync(file) ? "" : "# drift-check ignore list\n";
    appendFileSync(file, `${prefix}${name}\n`, "utf8");
    process.stdout.write(`drift-check: added ${name} to .driftignore\n`);
  });

program
  .command("report")
  .description("Alias for scan --format json (machine readable)")
  .option("--format <fmt>", "pretty | json", "json")
  .action((opts: { format: string }) => {
    const cwd = (program.opts() as { cwd: string }).cwd;
    const cfg = loadConfig(cwd);
    const report = scan({
      cwd,
      ignore: cfg.ignore ?? [],
      ...(cfg.workspaceGlobs ? { workspaceGlobs: cfg.workspaceGlobs } : {}),
    });
    process.stdout.write(opts.format === "pretty" ? formatPretty(report) : formatJson(report));
    process.stdout.write("\n");
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`drift-check: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
