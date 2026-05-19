import { describe, expect, it } from "vitest";
import {
  MemoryStore,
  matches,
  applyEventToDocuments,
  applyOptimisticInsert,
  applyOptimisticUpdate,
  applyOptimisticDelete,
} from "../src/index.js";

describe("matches (filter engine)", () => {
  it("matches simple equality", () => {
    expect(matches({ _id: "1", a: 1 }, { a: 1 })).toBe(true);
    expect(matches({ _id: "1", a: 2 }, { a: 1 })).toBe(false);
  });
  it("supports operators", () => {
    expect(matches({ _id: "1", a: 5 }, { a: { $gt: 3 } })).toBe(true);
    expect(matches({ _id: "1", a: 5 }, { a: { $in: [1, 5, 9] } })).toBe(true);
    expect(matches({ _id: "1", a: 5 }, { a: { $nin: [5] } })).toBe(false);
    expect(matches({ _id: "1", a: 5 }, { b: { $exists: false } })).toBe(true);
  });
  it("supports $or / $and", () => {
    expect(matches({ _id: "1", a: 1, b: 2 }, { $or: [{ a: 0 }, { b: 2 }] })).toBe(true);
    expect(matches({ _id: "1", a: 1, b: 2 }, { $and: [{ a: 1 }, { b: 2 }] })).toBe(true);
  });
  it("supports dotted paths", () => {
    expect(matches({ _id: "1", user: { name: "alice" } }, { "user.name": "alice" })).toBe(true);
  });
});

describe("MemoryStore", () => {
  it("inserts and finds docs", () => {
    const s = new MemoryStore();
    const doc = s.insert("users", { name: "alice" });
    expect(doc._id).toBeDefined();
    expect(s.find("users")).toHaveLength(1);
    expect(s.findOne("users", doc._id)).toEqual(doc);
  });

  it("updates and deletes", () => {
    const s = new MemoryStore();
    const doc = s.insert<{ _id: string; name: string; active: boolean }>("users", {
      name: "a",
      active: true,
    });
    s.update("users", doc._id, { active: false });
    expect(s.findOne<{ active: boolean }>("users", doc._id)?.active).toBe(false);
    expect(s.delete("users", doc._id)).toBe(true);
    expect(s.find("users")).toHaveLength(0);
  });

  it("emits change events", () => {
    const s = new MemoryStore();
    const events: string[] = [];
    s.watch((e) => events.push(e.type));
    const d = s.insert("c", { a: 1 });
    s.update("c", d._id, { a: 2 });
    s.delete("c", d._id);
    expect(events).toEqual(["insert", "update", "delete"]);
  });

  it("returns snapshot with version", () => {
    const s = new MemoryStore();
    s.insert("c", { a: 1 });
    s.insert("c", { a: 2 });
    const snap = s.snapshot("c");
    expect(snap.documents).toHaveLength(2);
    expect(snap.version).toBe(2);
  });
});

describe("applyEventToDocuments", () => {
  it("applies snapshot", () => {
    const r = applyEventToDocuments<{ _id: string }>([], 0, {
      type: "snapshot",
      collection: "c",
      documents: [{ _id: "1" }, { _id: "2" }],
      version: 5,
    });
    expect(r.data).toHaveLength(2);
    expect(r.version).toBe(5);
  });
  it("applies insert", () => {
    const r = applyEventToDocuments([{ _id: "1" }], 1, {
      type: "insert",
      collection: "c",
      document: { _id: "2" },
      version: 2,
    });
    expect(r.data.map((d) => d._id).sort()).toEqual(["1", "2"]);
  });
  it("applies update", () => {
    const r = applyEventToDocuments(
      [{ _id: "1", a: 1 } as { _id: string; a: number }],
      1,
      { type: "update", collection: "c", documentId: "1", patch: { a: 9 }, version: 2 },
    );
    expect(r.data[0]!.a).toBe(9);
  });
  it("applies delete", () => {
    const r = applyEventToDocuments([{ _id: "1" }, { _id: "2" }], 1, {
      type: "delete",
      collection: "c",
      documentId: "1",
      version: 2,
    });
    expect(r.data.map((d) => d._id)).toEqual(["2"]);
  });
});

describe("optimistic helpers", () => {
  it("insert/update/delete work on plain arrays", () => {
    const docs = [{ _id: "1", n: 1 }];
    const next1 = applyOptimisticInsert(docs, { _id: "2", n: 2 });
    expect(next1).toHaveLength(2);
    const next2 = applyOptimisticUpdate(next1, "1", { n: 100 });
    expect(next2.find((d) => d._id === "1")?.n).toBe(100);
    const next3 = applyOptimisticDelete(next2, "1");
    expect(next3.map((d) => d._id)).toEqual(["2"]);
  });
});
