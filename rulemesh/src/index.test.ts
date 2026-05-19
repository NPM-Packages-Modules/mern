import { describe, expect, it } from "vitest";
import { ruleMesh } from "./index.js";

describe("rulemesh", () => {
  it("runs matching rules in priority order", async () => {
    const log: string[] = [];
    const mesh = ruleMesh<{ id: string; plan?: string }>()
      .when(
        "user.created",
        async () => {
          log.push("b");
        },
        undefined,
        10
      )
      .when(
        "user.created",
        async () => {
          log.push("a");
        },
        undefined,
        0
      )
      .when("user.created", async (ctx) => log.push(`p:${ctx.plan}`), (ctx) => ctx.plan === "pro");
    await mesh.emit("user.created", { id: "1" });
    expect(log).toEqual(["a", "b"]);
    await mesh.emit("user.created", { id: "2", plan: "pro" });
    expect(log.slice(-3)).toEqual(["a", "p:pro", "b"]);
  });
});
