import { describe, expect, it } from "vitest"; import { modstackLoadDir } from "./index.js"; import { mkdtemp, rm } from "node:fs/promises"; import { tmpdir } from "node:os"; import path from "node:path";
it("m", async ()=>{ const d=await mkdtemp(path.join(tmpdir(),"ms-")); try{ expect((await modstackLoadDir(d)).length).toBe(0);}finally{ await rm(d,{recursive:true,force:true});}});
