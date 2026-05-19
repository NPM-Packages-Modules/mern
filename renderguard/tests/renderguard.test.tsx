import * as React from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { computeRenderScore, renderguard } from "../src/index.js";

function Child({ n }: { n: number }) {
  return <span>{n}</span>;
}

describe("renderguard", () => {
  it("invokes onRender", () => {
    const seen: string[] = [];
    const Guard = renderguard("root", {
      onRender: (r) => seen.push(`${r.id}:${r.phase}`),
    });
    TestRenderer.create(
      <Guard>
        <Child n={1} />
      </Guard>,
    );
    expect(seen.some((s) => s.includes("root"))).toBe(true);
  });

  it("computeRenderScore", () => {
    expect(computeRenderScore([1, 1])).toBeGreaterThan(90);
    expect(computeRenderScore([40, 40])).toBeLessThan(20);
  });
});
