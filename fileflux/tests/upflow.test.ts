import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import {
  upflow,
  MemoryStorage,
  sanitizeFilename,
  appendUuidSuffix,
  detectMimeFromBytes,
  mimeMatchesAllowed,
  FileTooLargeError,
  InvalidMimeTypeError,
} from "../src/index.js";

function buildMultipart(boundary: string, parts: { name: string; filename?: string; type?: string; body: Buffer | string }[]): Buffer {
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (p.filename) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${p.type ?? "application/octet-stream"}\r\n\r\n`));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n`));
    }
    chunks.push(typeof p.body === "string" ? Buffer.from(p.body) : p.body);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("utils", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("evil<name>?.txt")).toBe("evil_name__.txt");
  });
  it("appends uuid", () => {
    expect(appendUuidSuffix("foo.png")).toMatch(/^foo-[0-9a-f]{8}\.png$/);
  });
  it("detects PNG magic bytes", () => {
    expect(detectMimeFromBytes(PNG_MAGIC)).toBe("image/png");
    expect(detectMimeFromBytes(JPG_MAGIC)).toBe("image/jpeg");
  });
  it("matches wildcard mime", () => {
    expect(mimeMatchesAllowed("image/png", ["image/*"])).toBe(true);
    expect(mimeMatchesAllowed("text/plain", ["image/*"])).toBe(false);
    expect(mimeMatchesAllowed("anything", undefined)).toBe(true);
  });
});

describe("DiskStorage logic via MemoryStorage", () => {
  it("uploads files via Express middleware", async () => {
    const storage = new MemoryStorage();
    const handler = upflow({ storage });

    const boundary = "----test";
    const body = buildMultipart(boundary, [
      { name: "file", filename: "hi.png", type: "image/png", body: PNG_MAGIC },
    ]);
    const req: any = Object.assign(Readable.from(body), {
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });

    await new Promise<void>((resolve, reject) =>
      handler.single("file")(req, {}, (err) => (err ? reject(err) : resolve())),
    );
    expect(req.file.mimeType).toBe("image/png");
    expect(req.file.size).toBeGreaterThan(0);
  });

  it("rejects oversized files", async () => {
    const storage = new MemoryStorage();
    const handler = upflow({
      storage,
      limits: { fileSize: 4 },
    });
    const boundary = "----b";
    const body = buildMultipart(boundary, [
      { name: "f", filename: "big.png", type: "image/png", body: PNG_MAGIC },
    ]);
    const req: any = Object.assign(Readable.from(body), {
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });
    await expect(
      new Promise<void>((resolve, reject) =>
        handler.single("f")(req, {}, (err) => (err ? reject(err) : resolve())),
      ),
    ).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it("rejects disallowed MIME types from magic bytes", async () => {
    const storage = new MemoryStorage();
    const handler = upflow({
      storage,
      limits: { allowedMimeTypes: ["application/pdf"] },
    });
    const boundary = "----c";
    const body = buildMultipart(boundary, [
      { name: "f", filename: "fake.pdf", type: "application/pdf", body: PNG_MAGIC },
    ]);
    const req: any = Object.assign(Readable.from(body), {
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });
    await expect(
      new Promise<void>((resolve, reject) =>
        handler.single("f")(req, {}, (err) => (err ? reject(err) : resolve())),
      ),
    ).rejects.toBeInstanceOf(InvalidMimeTypeError);
  });
});
