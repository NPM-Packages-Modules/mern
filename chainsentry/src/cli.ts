#!/usr/bin/env node
import { Command } from "commander";
import { scan, audit } from "./scanner.js";
import { formatReport, formatJson, formatPackage } from "./format.js";
import { loadConfig } from "./config.js";
import { collectMaintainersFromDisk, saveBaseline } from "./baseline.js";
import { severityAtLeast } from "./scoring.js";
import type { RiskLevel } from "./types.js";

const program = new Command();
program
  .name("depguard")
  .description("Supply-chain security scanner for npm projects")
  .option("--cwd <path>", "Working directory", process.cwd());

program
  .command("scan", { isDefault: true })
  .description("Scan the current project's installed packages")
  .option("--fail-on <severity>", "Exit 1 when any finding ≥ severity")
  .option("--format <fmt>", "Output format: pretty | json", "pretty")
  .option("--no-network", "Skip registry calls")
  .option("--depth <depth>", "direct | all", "all")
  .action(async (opts: { failOn?: string; format: string; network: boolean; depth: string }) => {
    const cwd = (program.opts() as { cwd: string }).cwd;
    const cfg = loadConfig(cwd);
    const failOn = (opts.failOn ?? cfg.failOn) as RiskLevel | undefined;
    const result = await scan({
      cwd,
      ignore: cfg.ignore ?? [],
      network: opts.network !== false,
      scanDepth: (opts.depth as "direct" | "all") ?? cfg.scanDepth ?? "all",
      ...(cfg.cacheTTL !== undefined ? { cacheTTL: cfg.cacheTTL } : {}),
    });

    process.stdout.write(opts.format === "json" ? formatJson(result) : formatReport(result));
    process.stdout.write("\n");

    if (failOn) {
      const hit = result.packages.some((p) => severityAtLeast(p.worstSeverity, failOn));
      if (hit) process.exit(1);
    }
  });

program
  .command("baseline")
  .description("Save current installed maintainers as the trusted baseline")
  .action(() => {
    const cwd = (program.opts() as { cwd: string }).cwd;
    const baseline = collectMaintainersFromDisk(cwd);
    saveBaseline(baseline);
    process.stdout.write(`depguard: baseline saved (${Object.keys(baseline).length} packages)\n`);
  });

program
  .command("audit <package>")
  .description("Audit a single package by name")
  .action(async (name: string) => {
    const result = await audit(name);
    if (!result) {
      process.stderr.write(`depguard: could not fetch metadata for "${name}"\n`);
      process.exit(1);
    }
    process.stdout.write(formatPackage(result) + "\n");
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`depguard: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
