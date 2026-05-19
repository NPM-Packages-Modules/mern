import { readdir } from "node:fs/promises"; import path from "node:path"; import { pathToFileURL } from "node:url";
export interface LM { name: string; defaultExport?: unknown }
export async function modstackLoadDir(abs: string, pat = /\.(plugin|mod)\.[cm]?js$/i): Promise<LM[]> {
const o: LM[] = []; let e; try{e=await readdir(abs,{withFileTypes:true});}catch{return o;}
for(const x of e){ if(!x.isFile()||!pat.test(x.name))continue; const u=pathToFileURL(path.join(abs,x.name)).href; const m=await import(u) as {default?:unknown};
o.push({name:x.name.replace(pat,""),defaultExport:m.default}); } return o; }
