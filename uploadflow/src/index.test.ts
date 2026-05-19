import { describe, expect, it } from "vitest"; import { uploadflow } from "./index.js";
it("u", async ()=>{ let n=0; await uploadflow<{n:number}>().step("a",async f=>{n+=f.n}).run({n:3}); expect(n).toBe(3); });
