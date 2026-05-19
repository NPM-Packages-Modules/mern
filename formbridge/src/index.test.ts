import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formbridge } from "./index.js";

describe("formbridge", () => {
  it("validates with zod", () => {
    const f = formbridge(z.object({ email: z.string().email() }));
    const bad = f.validate({ email: "nope" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.fieldErrors.email?.length).toBeGreaterThan(0);
    const ok = f.validate({ email: "a@b.co" });
    expect(ok.success).toBe(true);
  });

  it("parses api fieldErrors map", () => {
    const f = formbridge(z.object({}));
    expect(f.errorsFromApiPayload({ details: { fieldErrors: { x: ["bad"] } } })).toEqual({ x: ["bad"] });
  });
});
