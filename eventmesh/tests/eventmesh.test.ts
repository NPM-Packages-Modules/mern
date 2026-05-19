import { describe, expect, it } from "vitest";
import { eventmesh } from "../src/index.js";

describe("eventmesh", () => {
  it("pub sub", async () => {
    const bus = eventmesh();
    const p = new Promise<string>((res) => {
      bus.subscribe<string>("user.created", (x) => res(x));
    });
    bus.publish("user.created", "u1");
    expect(await p).toBe("u1");
  });
});
