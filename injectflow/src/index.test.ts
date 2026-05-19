import { describe, expect, it } from "vitest";
import { injectflow } from "./index.js";

describe("injectflow", () => {
  it("resolves singleton once", () => {
    const c = injectflow();
    let n = 0;
    c.register(
      "svc",
      () => {
        n += 1;
        return { n };
      },
      { singleton: true }
    );
    expect(c.resolve<{ n: number }>("svc").n).toBe(1);
    expect(c.resolve<{ n: number }>("svc").n).toBe(1);
    expect(n).toBe(1);
  });

  it("transient creates new instances", () => {
    const c = injectflow();
    c.register("x", () => ({}), { singleton: false });
    expect(c.resolve("x")).not.toBe(c.resolve("x"));
  });
});
