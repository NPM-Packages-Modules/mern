import { describe, expect, it } from "vitest"; import { z } from "zod"; import { schemagenDtoInterface, schemagenFields } from "./index.js";
it("s", () => { const o=z.object({id:z.string()}); expect(schemagenFields(o)[0]?.key).toBe("id"); expect(schemagenDtoInterface(o,"U")).toContain("interface U"); });
