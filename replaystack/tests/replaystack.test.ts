import { describe, expect, it } from "vitest";
import { parseCaptureList, replayOne } from "../src/index.js";

describe("replaystack", () => {
  it("parseCaptureList", () => {
    const x = parseCaptureList([{ method: "GET", url: "/a" }]);
    expect(x[0]!.url).toBe("/a");
  });

  it("replayOne hits local", async () => {
    const res = await replayOne("http://example.com", { method: "GET", url: "http://example.com" });
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
