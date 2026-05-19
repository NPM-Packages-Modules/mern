import pc from "picocolors";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const [, , cmd, dir] = process.argv;
  if (cmd === "analyze") {
    const root = resolve(dir ?? ".");
    const raw = await readFile(resolve(root, "package.json"), "utf8");
    const pj = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const names = new Set([
      ...Object.keys(pj.dependencies ?? {}),
      ...Object.keys(pj.devDependencies ?? {}),
    ]);
    const sorted = [...names].sort();
    console.log(pc.cyan("graphstack"), "analyze —", sorted.length, "packages");
    for (const n of sorted) console.log(" ", n);
    return;
  }
  console.log(pc.cyan("graphstack"), "analyze [dir]");
  process.exit(cmd ? 1 : 0);
}
void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
