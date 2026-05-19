import { describe, expect, it } from "vitest";
import { workflowMesh } from "./index.js";

describe("workflowmesh", () => {
  it("chains steps with retry", async () => {
    let n = 0;
    const log: string[] = [];
    const mesh = workflowMesh<{ n: number }>()
      .step({
        name: "a",
        retry: 2,
        run: (ctx) => {
          log.push(`a:${ctx.n}`);
        },
      })
      .step({
        name: "b",
        retry: 3,
        run: () => {
          n += 1;
          log.push(`b:try:${n}`);
          if (n < 2) throw new Error("retry");
        },
      });
    await mesh.run({ n: 1 });
    expect(log[0]).toBe("a:1");
    expect(log.some((x) => x.startsWith("b:try"))).toBe(true);
  });

  it("rolls back completed steps on failure", async () => {
    const rb: string[] = [];
    const mesh = workflowMesh<{ id: string }>()
      .step({
        name: "ok",
        run: () => {},
        rollback: () => rb.push("ok"),
      })
      .step({
        name: "fail",
        run: () => {
          throw new Error("x");
        },
      });
    await expect(mesh.runWithRollback({ id: "1" })).rejects.toThrow("x");
    expect(rb).toEqual(["ok"]);
  });
});
