import { describe, expect, it } from "vitest"; import { eventforge } from "./index.js";
it("e", async ()=>{ const b=eventforge(); const l:number[]=[]; b.on("x",async (n:number)=>l.push(n)); await b.emit("x",2); expect(l).toEqual([2]); });
