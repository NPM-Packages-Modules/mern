import { describe, expect, it } from "vitest";
import { dbmesh } from "./index.js";

it("users.find", async () => {
  const mesh = dbmesh();
  mesh.use("users", {
    find: async (f) => [{ id: "1", ...(f as object) }],
  });
  const rows = await mesh.users.find({ id: "1" });
  expect(rows[0]?.id).toBe("1");
});
