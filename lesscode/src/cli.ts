import pc from "picocolors"; import { readdir, readFile } from "node:fs/promises"; import path from "node:path";
async function walk(dir: string): Promise<string[]> { let e; try { e = await readdir(dir,{withFileTypes:true}); } catch { return []; }
const o: string[] = []; for(const x of e){ const p=path.join(dir,x.name); if(x.isDirectory()&&x.name!=="node_modules") o.push(...await walk(p)); else if(x.isFile()&&/\.(ts|tsx|js)$/.test(x.name)) o.push(p); } return o; }
async function main(){ const [,,cmd,dir]=process.argv; if(cmd==="analyze"){ const root=path.resolve(dir??"src"); const files=await walk(root); let hits=0;
for(const f of files){ const t=await readFile(f,"utf8"); hits+=(t.match(/\.(get|post|put|patch|delete|use)\(/g)?.length??0); }
console.log(pc.green("lesscode"), root, "files="+files.length, "calls="+hits); return; }
console.log(pc.cyan("lesscode"),"analyze [dir]"); process.exit(cmd?1:0); }
void main().catch(e=>{console.error(e);process.exit(1);});
