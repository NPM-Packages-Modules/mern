import pc from "picocolors";
import { seedforge } from "./index.js";

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  let seed = 42;
  const i = argv.indexOf("--seed");
  if (i >= 0 && argv[i + 1]) seed = Number.parseInt(argv[i + 1]!, 10) || 42;

  if (cmd === "run") {
    const sf = seedforge();
    sf.register("noop", () => {});
    await sf.runAll({ seed, log: () => {} });
    console.log(pc.green("seedforge"), "completed with seed", seed);
    console.log(pc.cyan("Tip:"), "import { seedforge } from \"@mr-aftab-ahmad-khan/seedforge\" and register your own dataset seeds.");
    return;
  }

  console.log(pc.cyan("seedforge"), "run [--seed <n>]");
  process.exit(cmd ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
