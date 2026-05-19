import { Readable } from "node:stream";

export interface MultipartFilePart {
  type: "file";
  fieldName: string;
  filename: string;
  mimeType: string;
  stream: Readable;
}
export interface MultipartFieldPart {
  type: "field";
  fieldName: string;
  value: string;
}
export type MultipartPart = MultipartFilePart | MultipartFieldPart;

/**
 * Multipart/form-data parser. Buffers the request body, then walks it
 * synchronously. Sized uploads are guarded by `limits.fileSize` in the caller.
 *
 * We chose buffer-then-parse over streaming because correctly streaming
 * multipart with proper boundary detection requires a non-trivial state
 * machine; buffering keeps the code small and the public API streaming-friendly
 * (each file part is exposed as a `Readable` you can pipe into S3, sharp, etc.).
 */
export async function* parseMultipart(
  body: Readable | AsyncIterable<Uint8Array>,
  boundary: string,
): AsyncIterable<MultipartPart> {
  const buf = await collect(body);
  const parts = splitParts(buf, boundary);
  for (const p of parts) yield p;
}

async function collect(body: Readable | AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  }
  return Buffer.concat(chunks);
}

function splitParts(buf: Buffer, boundary: string): MultipartPart[] {
  const out: MultipartPart[] = [];
  const delim = Buffer.from(`--${boundary}`);
  const CRLF = Buffer.from("\r\n");

  let cursor = buf.indexOf(delim);
  if (cursor === -1) return out;
  cursor += delim.length;

  while (cursor < buf.length) {
    if (buf.slice(cursor, cursor + 2).equals(Buffer.from("--"))) return out;
    if (buf.slice(cursor, cursor + 2).equals(CRLF)) cursor += 2;

    const headerEnd = buf.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) return out;
    const headerStr = buf.slice(cursor, headerEnd).toString("utf8");
    cursor = headerEnd + 4;

    const headers: Record<string, string> = {};
    for (const line of headerStr.split("\r\n")) {
      const c = line.indexOf(":");
      if (c === -1) continue;
      headers[line.slice(0, c).toLowerCase().trim()] = line.slice(c + 1).trim();
    }

    const sep = Buffer.concat([CRLF, delim]);
    const partEnd = buf.indexOf(sep, cursor);
    if (partEnd === -1) return out;
    const body = buf.slice(cursor, partEnd);
    cursor = partEnd + sep.length;

    const disposition = headers["content-disposition"] ?? "";
    const nameMatch = /name="([^"]*)"/.exec(disposition);
    const filenameMatch = /filename="([^"]*)"/.exec(disposition);
    const fieldName = nameMatch ? nameMatch[1] ?? "" : "";
    const filename = filenameMatch ? filenameMatch[1] ?? "" : "";
    const mimeType = headers["content-type"] ?? "application/octet-stream";

    if (filename) {
      out.push({
        type: "file",
        fieldName,
        filename,
        mimeType,
        stream: Readable.from(body),
      });
    } else {
      out.push({ type: "field", fieldName, value: body.toString("utf8") });
    }
  }
  return out;
}

export function getBoundary(contentType: string | undefined): string | undefined {
  if (!contentType) return undefined;
  const m = /boundary="?([^";]+)"?/i.exec(contentType);
  return m ? m[1] : undefined;
}
