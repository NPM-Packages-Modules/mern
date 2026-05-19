#!/usr/bin/env node
import pc from "picocolors";
import { resolve } from "node:path";
import { runAllChecks } from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "check") {
    console.log(`${pc.cyan("deployguard")} check [projectRoot]`);
    process.exit(args[0] === "help" ? 0 : 1);
  }
  const root = resolve(args[1] ?? ".");
  const rows = await runAllChecks(root);
  let bad = 0;
  for (const r of rows) {
    const ok = r.ok ? pc.green("OK") : pc.red("NO");
    console.log(`${ok} ${pc.bold(r.name)} — ${r.detail ?? ""}`);
    if (!r.ok) bad += 1;
  }
  process.exit(bad ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
