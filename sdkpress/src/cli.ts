import pc from "picocolors"; import { readFile, writeFile } from "node:fs/promises"; import { resolve } from "node:path";
import { generateSdkSnippet } from "./index.js";
async function main() { const a = process.argv.slice(2); const [cmd, f, out] = a;
if (cmd === "generate" && f) { const raw = JSON.parse(await readFile(resolve(f),"utf8")); const keys = raw.paths ? Object.keys(raw.paths) : [];
await writeFile(resolve(out ?? "sdkpress.client.ts"), "/** sdkpress */\n"+generateSdkSnippet("http://localhost:3000", keys), "utf8");
console.log(pc.green("Wrote")); return; }
console.log(pc.cyan("sdkpress"), "generate <openapi.json> [out]"); process.exit(cmd?1:0); }
void main().catch((e)=>{ console.error(e); process.exit(1); });
