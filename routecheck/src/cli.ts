#!/usr/bin/env node
import pc from "picocolors";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Express } from "express";
import { generateVitestStub, listExpressRoutes } from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "generate" || !args[1]) {
    console.log(`${pc.cyan("routecheck")} generate <path-to-app.js|cjs|mjs> [outfile]`);
    process.exit(args[0] === "help" ? 0 : 1);
  }
  const target = resolve(args[1]!);
  const mod = (await import(pathToFileURL(target).href)) as { app?: Express; default?: Express };
  const app = mod.app ?? mod.default;
  if (!app || typeof app.listen !== "function") {
    console.error(pc.red('Export an Express instance as default or named `app`.'));
    process.exit(1);
  }
  const routes = listExpressRoutes(app);
  const out = args[2] ? resolve(args[2]!) : resolve(process.cwd(), "api.generated.test.ts");
  writeFileSync(out, generateVitestStub(routes), "utf8");
  console.log(pc.green(`Wrote ${routes.length} stub(s) to ${out}`));
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
