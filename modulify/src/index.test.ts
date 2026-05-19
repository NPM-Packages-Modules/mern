import { describe, expect, it } from "vitest";
import { mountPathFromFilename } from "./index.js";

describe("modulify", () => {
  it("mountPathFromFilename strips .router.js", () => {
    expect(mountPathFromFilename("users.router.js")).toBe("/users");
    expect(mountPathFromFilename("api.v1.health.router.cjs", /\.router\.[cm]?js$/i)).toBe("/api.v1.health");
  });
});
