import { randomBytes } from "node:crypto";
import { matches } from "./filter.js";
import type { ChangeEvent, Filter, StoreSnapshot, SyncDocument } from "./types.js";

export interface SyncStore {
  insert<T extends SyncDocument>(collection: string, document: Omit<T, "_id"> & { _id?: string }): T;
  update<T extends SyncDocument>(collection: string, id: string, patch: Partial<T>): T | undefined;
  delete(collection: string, id: string): boolean;
  find<T extends SyncDocument>(collection: string, filter?: Filter): T[];
  findOne<T extends SyncDocument>(collection: string, id: string): T | undefined;
  snapshot<T extends SyncDocument>(collection: string, filter?: Filter): StoreSnapshot<T>;
  watch(handler: (event: ChangeEvent) => void): () => void;
  version(collection: string): number;
  reset(): void;
}

export class MemoryStore implements SyncStore {
  private collections = new Map<string, Map<string, SyncDocument>>();
  private versions = new Map<string, number>();
  private watchers = new Set<(e: ChangeEvent) => void>();

  insert<T extends SyncDocument>(collection: string, doc: Omit<T, "_id"> & { _id?: string }): T {
    const id = doc._id ?? `doc_${randomBytes(8).toString("hex")}`;
    const map = this.ensureCollection(collection);
    const document = { ...doc, _id: id } as unknown as T;
    map.set(id, document);
    const version = this.bumpVersion(collection);
    this.emit({ type: "insert", collection, document, version });
    return document;
  }

  update<T extends SyncDocument>(collection: string, id: string, patch: Partial<T>): T | undefined {
    const map = this.collections.get(collection);
    if (!map) return undefined;
    const existing = map.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, _id: id } as T;
    map.set(id, updated);
    const version = this.bumpVersion(collection);
    this.emit({ type: "update", collection, documentId: id, patch, version });
    return updated;
  }

  delete(collection: string, id: string): boolean {
    const map = this.collections.get(collection);
    if (!map) return false;
    if (!map.delete(id)) return false;
    const version = this.bumpVersion(collection);
    this.emit({ type: "delete", collection, documentId: id, version });
    return true;
  }

  find<T extends SyncDocument>(collection: string, filter?: Filter): T[] {
    const map = this.collections.get(collection);
    if (!map) return [];
    const out: T[] = [];
    for (const doc of map.values()) {
      if (matches(doc, filter)) out.push(doc as T);
    }
    return out;
  }

  findOne<T extends SyncDocument>(collection: string, id: string): T | undefined {
    return this.collections.get(collection)?.get(id) as T | undefined;
  }

  snapshot<T extends SyncDocument>(collection: string, filter?: Filter): StoreSnapshot<T> {
    return { documents: this.find<T>(collection, filter), version: this.version(collection) };
  }

  watch(handler: (event: ChangeEvent) => void): () => void {
    this.watchers.add(handler);
    return () => this.watchers.delete(handler);
  }

  version(collection: string): number {
    return this.versions.get(collection) ?? 0;
  }

  reset(): void {
    this.collections.clear();
    this.versions.clear();
  }

  private ensureCollection(collection: string): Map<string, SyncDocument> {
    let map = this.collections.get(collection);
    if (!map) {
      map = new Map();
      this.collections.set(collection, map);
    }
    return map;
  }

  private bumpVersion(collection: string): number {
    const next = this.version(collection) + 1;
    this.versions.set(collection, next);
    return next;
  }

  private emit(event: ChangeEvent): void {
    for (const w of this.watchers) {
      try { w(event); } catch { /* swallow individual subscriber errors */ }
    }
  }
}
