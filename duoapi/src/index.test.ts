import { describe, expect, it } from "vitest";
import { z } from "zod"; import { duoapi } from "./index.js";
it("duoapi", () => { const u = duoapi({ name: "User", schema: z.object({ email: z.string() }) });
expect(u.restBase).toBe("/api/users"); expect(u.graphqlSDL).toContain("type User"); });
