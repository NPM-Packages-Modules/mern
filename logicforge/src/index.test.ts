import { describe, expect, it } from "vitest";
import { logicforgePredicateFromIf, logicforgeRule } from "./index.js";

it("order > 100", () => {
  const p = logicforgePredicateFromIf("order > 100");
  expect(p({ order: 99 })).toBe(false);
  expect(p({ order: 101 })).toBe(true);
});

it("rule", () => {
  const r = logicforgeRule({ if: "x >= 2" }, (ctx) => ctx.x);
  expect(r.when({ x: 2 })).toBe(true);
  expect(r.run?.({ x: 3 })).toBe(3);
});
