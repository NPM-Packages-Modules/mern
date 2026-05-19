import { describe, expect, it } from "vitest"; import { transactly } from "./index.js";
it("t", async () => { let n=0; const v=await transactly(async()=>{n++; if(n<2)throw new Error("x"); return 1;},{retries:3,delayMs:()=>1}); expect(v).toBe(1); });
