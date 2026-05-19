import pc from "picocolors"; import { writeFile } from "node:fs/promises"; import { resolve } from "node:path";
async function main(){ const [,,cmd,out]=process.argv; if(cmd==="generate"){ const p=resolve(out??"generated.test.ts");
await writeFile(p, "import { describe, it, expect } from \"vitest\";\ndescribe(\"gen\", () => { it(\"ok\", () => expect(1).toBe(1)); });\n", "utf8");
console.log(pc.green("Wrote"), p); return; } console.log(pc.cyan("testforge"), "generate [file]"); process.exit(cmd?1:0); }
void main().catch(e=>{console.error(e);process.exit(1);});
