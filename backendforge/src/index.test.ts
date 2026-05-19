import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scaffoldModule } from "./index.js";

describe("backendforge", () => {
  it("scaffolds router and service files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bf-"));
    try {
      const r = await scaffoldModule("user-profiles", dir);
      expect(r.files.length).toBe(2);
      const router = await readFile(r.files[0]!, "utf8");
      expect(router).toContain("user-profiles");
      const svc = await readFile(r.files[1]!, "utf8");
      expect(svc).toContain("UserProfiles");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
