import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { SourceNotFoundError } from "./errors.js";
import type { SourceAdapter } from "./types.js";

export class FileSystemSource implements SourceAdapter {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async fetch(key: string) {
    const abs = resolve(this.root, key);
    if (!abs.startsWith(this.root + sep) && abs !== this.root) {
      throw new SourceNotFoundError(key);
    }
    if (!existsSync(abs)) return undefined;
    const buffer = readFileSync(abs);
    return { buffer, mimeType: mimeFromExtension(abs) };
  }
}

function mimeFromExtension(path: string): string {
  const ext = path.toLowerCase().slice(path.lastIndexOf(".") + 1);
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "avif": return "image/avif";
    case "gif": return "image/gif";
    case "bmp": return "image/bmp";
    default: return "application/octet-stream";
  }
}
