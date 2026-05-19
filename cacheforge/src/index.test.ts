import { describe, expect, it } from "vitest"; import { cacheforge } from "./index.js";
it("c", ()=>{ const c=cacheforge(); c.set("a",1,10000,["t"]); expect(c.get("a")).toBe(1); c.invalidateTag("t"); expect(c.get("a")).toBeUndefined(); });
