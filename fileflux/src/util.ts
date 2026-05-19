import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

const RESERVED_WIN = /[<>:"/\\|?*\x00-\x1f]/g;

export function sanitizeFilename(name: string): string {
  let safe = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  safe = safe.replace(RESERVED_WIN, "_");
  safe = safe.replace(/\.\./g, "_");
  safe = safe.replace(/\s+/g, "_");
  safe = safe.replace(/^[._-]+/, "");
  if (!safe || safe === ".") safe = "file";
  return safe.slice(0, 200);
}

export function appendUuidSuffix(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${stem}-${randomUUID().slice(0, 8)}${ext}`;
}

interface MagicSignature {
  bytes: number[];
  mime: string;
  offset?: number;
}

const MAGIC_TABLE: MagicSignature[] = [
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },
  { bytes: [0x42, 0x4d], mime: "image/bmp" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" }, // also AVI/WAV — narrowed below
  { bytes: [0x66, 0x74, 0x79, 0x70], mime: "video/mp4", offset: 4 },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },
  { bytes: [0x1f, 0x8b], mime: "application/gzip" },
];

export function detectMimeFromBytes(buf: Buffer): string | undefined {
  for (const sig of MAGIC_TABLE) {
    const off = sig.offset ?? 0;
    if (buf.length < off + sig.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[off + i] !== sig.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      if (sig.mime === "image/webp" && buf.length >= 12) {
        const tag = buf.slice(8, 12).toString("ascii");
        if (tag === "WEBP") return "image/webp";
        if (tag === "WAVE") return "audio/wav";
        if (tag.startsWith("AVI")) return "video/x-msvideo";
        return undefined;
      }
      return sig.mime;
    }
  }
  return undefined;
}

export function mimeMatchesAllowed(mime: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  for (const pattern of allowed) {
    if (pattern === mime) return true;
    if (pattern.endsWith("/*") && mime.startsWith(pattern.slice(0, -1))) return true;
    if (pattern === "*/*") return true;
  }
  return false;
}

/** Convert a Web ReadableStream into a Node Readable. */
export function webStreamToNode(stream: ReadableStream<Uint8Array>): Readable {
  const reader = stream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) this.push(null);
        else this.push(Buffer.from(value));
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
}

export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_m, key: string) => vars[key] ?? "");
}
