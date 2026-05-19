import { describe, expect, it } from "vitest";
import { buildUnsignedPutUrl, validateUpload } from "../src/index.js";

describe("uploadmesh", () => {
  it("validates mime and size", () => {
    expect(
      validateUpload({ size: 10, mimetype: "image/png" }, { maxBytes: 100, allowedMime: ["image/png"] }).ok,
    ).toBe(true);
    expect(validateUpload({ size: 200, mimetype: "image/png" }, { maxBytes: 100, allowedMime: ["image/png"] })).toEqual({
      ok: false,
      error: "size",
    });
  });

  it("buildUnsignedPutUrl", () => {
    expect(buildUnsignedPutUrl("b", "a/b")).toContain("b");
  });
});
