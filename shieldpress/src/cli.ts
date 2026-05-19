#!/usr/bin/env node
import pc from "picocolors";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { mergeFindings, scanSource, type Finding } from "./index.js";

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "scan" || !args[1]) {
    console.log(`${pc.cyan("shieldpress")} scan <dir>`);
    process.exit(args[0] === "help" ? 0 : 1);
  }
  const root = resolve(args[1]!);
  const files = await walk(root);
  const all: Finding[] = [];
  for (const f of files) {
    const txt = await readFile(f, "utf8");
    all.push(...scanSource(f, txt));
  }
  const { errors, warns } = mergeFindings(all);
  for (const f of all) {
    const tag = f.severity === "error" ? pc.red("ERR") : pc.yellow("WARN");
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`${tag} ${pc.dim(f.rule)} ${where} — ${f.message}`);
  }
  console.log(pc.cyan(`Summary: ${errors} error(s), ${warns} warn(s)`));
  process.exit(errors > 0 ? 2 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
