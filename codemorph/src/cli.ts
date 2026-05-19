import pc from "picocolors";
import path from "node:path";
import { findDuplicateSources } from "./index.js";

async function main() {
  const [cmd, dir] = process.argv.slice(2);
  const root = path.resolve(dir ?? process.cwd());
  if (cmd === "analyze") {
    const dups = await findDuplicateSources(root);
    if (!dups.length) {
      console.log(pc.green("No normalized duplicates in"), root);
      return;
    }
    for (const d of dups) {
      console.log(pc.yellow(d.digest.slice(0, 12)), `(${d.files.length} files)`);
      for (const f of d.files) console.log(" ", f);
    }
    return;
  }
  console.log(pc.cyan("codemorph"), "analyze [dir]");
  process.exit(cmd ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
