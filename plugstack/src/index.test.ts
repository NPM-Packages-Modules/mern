import { describe, expect, it } from "vitest"; import { plugstack } from "./index.js";
it("p", async ()=>{ const ps=plugstack<{n:number}>(); let x=0; ps.use({name:"a",init:async ctx=>{x+=ctx.n}}); await ps.boot({n:2}); expect(x).toBe(2); });
