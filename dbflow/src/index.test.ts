import { describe, expect, it } from "vitest"; import { dbflowRepo } from "./index.js";
it("d", async ()=>{ const r=dbflowRepo<{id:string},{id:string}>({
findMany: async (f) => (f.id ? [{ id: f.id }] : []),
findOne: async () => null, save: async (d) => d, remove: async () => 0 });
expect((await r.findMany({ id: "1" })).length).toBe(1); });
