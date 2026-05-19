import { describe, expect, it } from "vitest";
import { generateSdkSource } from "../src/index.js";

describe("sdkforge", () => {
  it("emits methods for paths", () => {
    const src = generateSdkSource({
      paths: {
        "/users": { get: { operationId: "listUsers" } },
        "/x": { post: {} },
      },
    });
    expect(src).toContain("listUsers");
    expect(src).toContain("POST");
  });
});
