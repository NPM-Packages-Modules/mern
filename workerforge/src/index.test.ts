import { describe, expect, it } from "vitest"; import { workerforge } from "./index.js";
it("w", async ()=>{ const x=workerforge(); const l:number[]=[]; x.process("e",async (n:number)=>l.push(n)); await x.dispatch("e",5); expect(l).toEqual([5]); });
