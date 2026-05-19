import pc from "picocolors";
import { scaffoldModule } from "./index.js";

async function main() {
  const [cmd, sub, name] = process.argv.slice(2);
  if (cmd === "create" && sub === "module" && name) {
    const r = await scaffoldModule(name);
    console.log(pc.green("backendforge"), "wrote:");
    for (const f of r.files) console.log(" ", pc.cyan(f));
    return;
  }
  console.log(pc.cyan("backendforge"), "create module <name>");
  process.exit(cmd ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
