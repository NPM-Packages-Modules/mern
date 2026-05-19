import { describe, expect, it } from "vitest"; import { z } from "zod"; import { configforgeLoad } from "./index.js";
it("c", ()=>{ const r=configforgeLoad(z.object({port:z.number()}), [{},{port:3000}]); expect(r.port).toBe(3000); });
