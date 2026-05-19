import { describe, expect, it } from "vitest"; import { hookretry } from "./index.js";
it("h", ()=>{ const x=hookretry(); x.record("a",{at:1,status:500}); expect(x.history("a").length).toBe(1); expect(x.nextBackoffMs(2,100)).toBe(400); });
