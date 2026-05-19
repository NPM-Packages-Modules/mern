#!/usr/bin/env node
import { resolve } from "node:path";
import pc from "picocolors";
import { audit } from "./auditor.js";
import { formatReport, reportToJson } from "./format.js";

interface CliArgs {
  command: "audit" | "graph" | "score" | "help";
  rootDir: string;
  json: boolean;
  failOn?: "info" | "warn" | "error";
  ignore: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const [, , cmd, ...rest] = argv;
  const command: CliArgs["command"] =
    cmd === "audit" || cmd === "graph" || cmd === "score" || cmd === "help" ? cmd : "audit";
  let rootDir = process.cwd();
  let json = false;
  let failOn: CliArgs["failOn"];
  const ignore: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--root" || a === "-r") rootDir = rest[++i] ?? rootDir;
    else if (a === "--json") json = true;
    else if (a === "--fail-on") {
      const v = rest[++i];
      if (v === "info" || v === "warn" || v === "error") failOn = v;
    } else if (a === "--ignore") {
      const v = rest[++i];
      if (v) ignore.push(v);
    } else if (a && !a.startsWith("-")) {
      rootDir = a;
    }
  }
  return { command, rootDir: resolve(rootDir), json, failOn, ignore };
}

function printHelp(): void {
  console.log(
    `${pc.bold("archsense")} - backend architecture audit\n\n` +
      `Usage:\n` +
      `  archsense audit [path]   [--ignore dist] [--json] [--fail-on warn|error|info]\n` +
      `  archsense score [path]\n` +
      `  archsense graph [path]   [--json]\n` +
      `  archsense help\n`,
  );
}

function exceedsFailOn(args: CliArgs, severities: Set<string>): boolean {
  if (!args.failOn) return false;
  const order = ["info", "warn", "error"];
  const min = order.indexOf(args.failOn);
  for (const sev of severities) {
    if (order.indexOf(sev) >= min) return true;
  }
  return false;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv);
  if (args.command === "help") {
    printHelp();
    return 0;
  }

  const report = audit({ rootDir: args.rootDir, ignore: args.ignore });

  if (args.command === "score") {
    if (args.json) {
      process.stdout.write(JSON.stringify({ score: report.score, grade: report.grade }) + "\n");
    } else {
      const c = report.score >= 80 ? pc.green : report.score >= 60 ? pc.yellow : pc.red;
      console.log(`${pc.bold("archsense score:")} ${c(String(report.score))}/100  grade: ${c(report.grade)}`);
    }
    return 0;
  }

  if (args.command === "graph") {
    const cycles = report.graph.cycles;
    if (args.json) {
      process.stdout.write(JSON.stringify(report.graph) + "\n");
    } else {
      console.log(`${pc.bold("modules:")} ${report.graph.nodes}`);
      console.log(`${pc.bold("edges:")}   ${report.graph.edges}`);
      console.log(`${pc.bold("cycles:")}  ${cycles.length}`);
      for (const c of cycles.slice(0, 10)) console.log(`  - ${c}`);
    }
    return 0;
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(reportToJson(report)) + "\n");
  } else {
    console.log(formatReport(report));
  }
  const severities = new Set(report.findings.map((f) => f.severity));
  return exceedsFailOn(args, severities) ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(pc.red(`fatal: ${(err as Error).message}`));
  process.exit(1);
});
