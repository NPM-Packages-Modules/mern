import { describe, expect, it } from "vitest";
import { wsmesh } from "./index.js";

describe("wsmesh", () => {
  it("manages rooms and leaveAll", () => {
    const mesh = wsmesh();
    mesh.join("chat", "c1");
    mesh.join("chat", "c2");
    mesh.join("alerts", "c1");
    expect(mesh.members("chat").sort()).toEqual(["c1", "c2"]);
    mesh.leaveAll("c1");
    expect(mesh.members("chat")).toEqual(["c2"]);
    expect(mesh.members("alerts")).toEqual([]);
  });

  it("channel.each visits members", () => {
    const mesh = wsmesh();
    mesh.join("r", "a");
    mesh.join("r", "b");
    const seen: string[] = [];
    mesh.channel("r").each((id) => seen.push(id));
    expect(seen.sort()).toEqual(["a", "b"]);
  });
});
