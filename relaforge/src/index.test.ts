import { describe, expect, it } from "vitest"; import { relaforgeNest, relaforgePaths } from "./index.js";
it("paths", () => { expect(relaforgePaths(["a.b","a.a.b"])).toEqual(["a.b"]); expect(relaforgeNest("u","p")).toBe("u.p"); });
