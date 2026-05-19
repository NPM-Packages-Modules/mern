import { describe, expect, it } from "vitest";
import { createSeededRng, seedforge } from "./index.js";

describe("seedforge", () => {
  it("createSeededRng is deterministic", () => {
    const a = createSeededRng(7);
    const b = createSeededRng(7);
    expect(a()).toBe(b());
  });

  it("runAll executes registered seeds", async () => {
    const sf = seedforge();
    const order: string[] = [];
    sf.register("a", async () => {
      order.push("a");
    });
    sf.register("b", async () => {
      order.push("b");
    });
    await sf.runAll({ seed: 1, log: () => {} });
    expect(order).toEqual(["a", "b"]);
  });
});
