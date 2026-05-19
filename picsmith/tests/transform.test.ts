import { describe, expect, it } from "vitest";
import { TransformOptionsSchema, pickFormat, makeCacheKey } from "../src/index.js";
import { DimensionLimitError } from "../src/errors.js";

describe("TransformOptions schema", () => {
  it("coerces query strings to numbers", () => {
    const r = TransformOptionsSchema.parse({ w: "800", h: "600", q: "75" });
    expect(r.w).toBe(800);
    expect(r.h).toBe(600);
    expect(r.q).toBe(75);
  });
  it("rejects oversized dimensions", () => {
    expect(() => TransformOptionsSchema.parse({ w: "9999" })).toThrow();
  });
});

describe("pickFormat", () => {
  it("picks AVIF when accepted", () => {
    expect(pickFormat("auto", "image/avif,image/webp", "jpeg")).toBe("avif");
  });
  it("picks WebP when AVIF missing", () => {
    expect(pickFormat("auto", "image/webp", "jpeg")).toBe("webp");
  });
  it("falls back to JPEG", () => {
    expect(pickFormat("auto", "*/*", "jpeg")).toBe("jpeg");
  });
  it("keeps PNG for transparent sources", () => {
    expect(pickFormat("auto", "*/*", "png")).toBe("png");
  });
  it("returns explicit format unchanged", () => {
    expect(pickFormat("avif", "*/*", "jpeg")).toBe("avif");
  });
});

describe("makeCacheKey", () => {
  it("produces stable keys for same options", () => {
    const a = makeCacheKey("foo.jpg", TransformOptionsSchema.parse({ w: "100" }), 1);
    const b = makeCacheKey("foo.jpg", TransformOptionsSchema.parse({ w: "100" }), 1);
    expect(a).toBe(b);
  });
  it("differs when options change", () => {
    const a = makeCacheKey("foo.jpg", TransformOptionsSchema.parse({ w: "100" }), 1);
    const b = makeCacheKey("foo.jpg", TransformOptionsSchema.parse({ w: "200" }), 1);
    expect(a).not.toBe(b);
  });
});

describe("DimensionLimitError", () => {
  it("includes requested and max", () => {
    const err = new DimensionLimitError(5000, 4000);
    expect(err.requested).toBe(5000);
    expect(err.max).toBe(4000);
    expect(err.status).toBe(413);
  });
});
