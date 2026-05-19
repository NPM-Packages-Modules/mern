import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import type { StorageAdapter } from "../types.js";

/** In-memory storage for tests. Records every upload and returns its buffer via `read`. */
export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, { buffer: Buffer; mimeType: string }>();

  async upload(input: { stream: Readable; filename: string; mimeType: string }) {
    const chunks: Buffer[] = [];
    for await (const c of input.stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as Uint8Array));
    const buffer = Buffer.concat(chunks);
    const key = `${randomUUID()}-${input.filename}`;
    this.store.set(key, { buffer, mimeType: input.mimeType });
    return { key, size: buffer.length };
  }

  read(key: string): Buffer | undefined {
    return this.store.get(key)?.buffer;
  }

  list(): string[] {
    return [...this.store.keys()];
  }

  clear(): void {
    this.store.clear();
  }
}
