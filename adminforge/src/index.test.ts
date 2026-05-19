import { describe, expect, it } from "vitest";
import { adminModel, buildAdminManifest } from "./index.js";

describe("adminforge", () => {
  it("buildAdminManifest", () => {
    const m = buildAdminManifest([
      adminModel({
        name: "User",
        path: "/api/users",
        fields: [{ key: "email", type: "string" }],
      }),
    ]);
    expect(m.version).toBe(1);
    expect(m.models[0]?.path).toBe("/api/users");
  });
});
