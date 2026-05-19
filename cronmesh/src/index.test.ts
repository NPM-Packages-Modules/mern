import { describe, expect, it } from "vitest"; import { cronmesh } from "./index.js";
it("c", () => expect(cronmesh().daily("r",async()=>{}).list()[0]?.schedule).toBe("daily"));
