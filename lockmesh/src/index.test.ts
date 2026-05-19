import { describe, expect, it } from "vitest"; import { lockmesh } from "./index.js";
it("l", async ()=>{ const x=lockmesh(); const hold=x.withLock("k",5000,async()=>{ await new Promise(r=>setTimeout(r,30)); return 1; }); await expect(x.withLock("k",5000,async()=>0)).rejects.toThrow(/busy/); expect(await hold).toBe(1); });
