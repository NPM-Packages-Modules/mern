import { describe, expect, it } from "vitest";
import { fusionstackCombine, fusionstackMergeObjects } from "./index.js";

it("combine", async () => {
  const r = await fusionstackCombine([
    async () => ({ a: 1 }),
    async () => {
      throw new Error("x");
    },
  ]);
  expect(r[0]?.ok).toBe(true);
  expect(r[1]?.ok).toBe(false);
});

it("merge", async () => {
  expect(await fusionstackMergeObjects([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 });
});
