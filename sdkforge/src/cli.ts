import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";
import { generateSdkSource, type OpenAPIV3 } from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "generate" || !args[1]) {
    console.log(pc.cyan("sdkforge"), "generate <openapi.json> [out.ts]");
    process.exit(1);
  }
  const input = resolve(args[1]!);
  const out = resolve(args[2] ?? resolve(process.cwd(), "api.client.ts"));
  const raw = JSON.parse(await readFile(input, "utf8")) as OpenAPIV3;
  await writeFile(out, generateSdkSource(raw), "utf8");
  console.log(pc.green(`Wrote ${out}`));
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
