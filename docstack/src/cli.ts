import pc from "picocolors"; import { readFile, writeFile } from "node:fs/promises"; import { resolve } from "node:path";
async function main(){ const [,,cmd,out]=process.argv; if(cmd==="generate"){ const pj=JSON.parse(await readFile(resolve("package.json"),"utf8")) as {name?:string;description?:string};
const md="\n## " + (pj.name??"package") + "\n\n" + (pj.description??"") + "\n";
await writeFile(resolve(out??"ARCHITECTURE.generated.md"), md, "utf8"); console.log(pc.green("Wrote")); return; }
console.log(pc.cyan("docstack"), "generate [out.md]"); process.exit(cmd?1:0); }
void main().catch(e=>{console.error(e);process.exit(1);});
