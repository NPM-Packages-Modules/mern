#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { loadDotEnv, mergeSources } from "./dotenv.js";
import { validate, explainSchema, formatIssues } from "./validator.js";
import type { Schema } from "./types.js";

interface CliArgs {
  command: "check" | "explain" | "help";
  schemaPath?: string;
  envFile?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const [, , cmd, ...rest] = argv;
  let command: CliArgs["command"] = "help";
  if (cmd === "check" || cmd === "explain" || cmd === "help") command = cmd;
  let schemaPath: string | undefined;
  let envFile: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--schema" || a === "-s") schemaPath = rest[++i];
    else if (a === "--env" || a === "-e") envFile = rest[++i];
  }
  return { command, schemaPath, envFile };
}

async function loadSchema(schemaPath: string): Promise<Schema> {
  const abs = resolve(process.cwd(), schemaPath);
  if (!existsSync(abs)) throw new Error(`Schema file not found: ${abs}`);
  const mod = await import(pathToFileURL(abs).href);
  const candidate = mod.default ?? mod.schema ?? mod.envSchema;
  if (!candidate || typeof candidate !== "object") {
    throw new Error(`Schema module must export default schema or named "schema"`);
  }
  return candidate as Schema;
}

function printHelp(): void {
  console.log(
    `${pc.bold("envguard")} - production-safe environment validator\n` +
      `\nUsage:\n` +
      `  envguard check   --schema ./env.schema.ts [--env .env]\n` +
      `  envguard explain --schema ./env.schema.ts\n` +
      `  envguard help\n`,
  );
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv);
  if (args.command === "help") {
    printHelp();
    return 0;
  }
  if (!args.schemaPath) {
    console.error(pc.red("error: --schema is required"));
    printHelp();
    return 2;
  }
  let schema: Schema;
  try {
    schema = await loadSchema(args.schemaPath);
  } catch (err) {
    console.error(pc.red(`error: ${(err as Error).message}`));
    return 2;
  }

  if (args.command === "explain") {
    const rows = explainSchema(schema);
    console.log(pc.bold("Schema:"));
    for (const r of rows) {
      const req = r.required ? pc.red("required") : pc.dim("optional");
      const sec = r.secret ? pc.yellow(" [secret]") : "";
      const def = r.default !== undefined ? pc.dim(` default=${JSON.stringify(r.default)}`) : "";
      const desc = r.description ? pc.dim(` — ${r.description}`) : "";
      console.log(`  ${pc.cyan(r.key)} ${pc.gray(r.kind)} ${req}${sec}${def}${desc}`);
    }
    return 0;
  }

  const fileSource = args.envFile ? loadDotEnv(args.envFile) : loadDotEnv(".env");
  const source = mergeSources(fileSource, process.env as Record<string, string | undefined>);
  const result = validate(schema, { source });
  if (result.ok) {
    console.log(pc.green(`✓ envguard: ${Object.keys(schema).length} variables valid`));
    return 0;
  }
  console.error(pc.red(`✗ envguard found ${result.issues.length} problem(s):`));
  console.error(formatIssues(result.issues));
  return 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(pc.red(`fatal: ${(err as Error).message}`));
  process.exit(1);
});
