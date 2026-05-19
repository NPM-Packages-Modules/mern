import { describe, expect, it } from "vitest"; import { retrystack } from "./index.js";
it("r", async ()=>{ let n=0; const v=await retrystack(async()=>{n++; if(n<2)throw new Error("x"); return 1;},{maxAttempts:3,initialDelayMs:1,jitter:false}); expect(v).toBe(1); });
