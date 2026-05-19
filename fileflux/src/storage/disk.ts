import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { applyTemplate, sanitizeFilename } from "../util.js";
import type { PresignOptions, PresignResult, StorageAdapter } from "../types.js";

export interface DiskStorageOptions {
  root: string;
  /** Template for the on-disk key. Variables: `{date}`, `{uuid}`, `{filename}`, `{ext}`. */
  pathTemplate?: string;
  /** Public URL prefix for files. Defaults to `undefined` (no URL). */
  publicUrlPrefix?: string;
}

export class DiskStorage implements StorageAdapter {
  readonly root: string;
  readonly pathTemplate: string;
  readonly publicUrlPrefix?: string;

  constructor(opts: DiskStorageOptions) {
    this.root = opts.root;
    this.pathTemplate = opts.pathTemplate ?? "{date}/{uuid}-{filename}";
    if (opts.publicUrlPrefix !== undefined) this.publicUrlPrefix = opts.publicUrlPrefix;
  }

  async upload(input: {
    stream: Readable;
    filename: string;
    mimeType: string;
  }): Promise<{ key: string; url?: string; size: number }> {
    const safe = sanitizeFilename(input.filename);
    const date = new Date().toISOString().slice(0, 10);
    const dot = safe.lastIndexOf(".");
    const ext = dot > 0 ? safe.slice(dot + 1) : "";
    const key = applyTemplate(this.pathTemplate, {
      date,
      uuid: randomUUID(),
      filename: safe,
      ext,
    });

    const fullPath = join(this.root, key);
    if (!existsSync(dirname(fullPath))) mkdirSync(dirname(fullPath), { recursive: true });

    let size = 0;
    input.stream.on("data", (c: Buffer) => {
      size += c.length;
    });

    await pipeline(input.stream, createWriteStream(fullPath));

    const result: { key: string; url?: string; size: number } = { key, size };
    if (this.publicUrlPrefix) {
      result.url = `${this.publicUrlPrefix.replace(/\/$/, "")}/${key}`;
    }
    return result;
  }

  async presign(_opts: PresignOptions): Promise<PresignResult> {
    throw new Error("DiskStorage does not support presigned uploads");
  }
}
