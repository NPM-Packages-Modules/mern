import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { parseMultipart, getBoundary, type MultipartFilePart } from "./multipart.js";
import {
  FileTooLargeError,
  InvalidMimeTypeError,
  UploadAbortedError,
  UploadError,
} from "./errors.js";
import {
  appendUuidSuffix,
  detectMimeFromBytes,
  mimeMatchesAllowed,
  sanitizeFilename,
  webStreamToNode,
} from "./util.js";
import type {
  PresignOptions,
  PresignResult,
  ProgressEvent,
  UploadedFile,
  UpflowOptions,
} from "./types.js";

type RequestLike = { headers: Record<string, string | string[] | undefined>; body?: unknown };

export class Upflow extends EventEmitter {
  readonly options: UpflowOptions;

  constructor(options: UpflowOptions) {
    super();
    this.options = options;
  }

  presign(opts: PresignOptions): Promise<PresignResult> {
    if (!this.options.storage.presign) {
      throw new UploadError("Storage adapter does not support presigned uploads", 501);
    }
    return this.options.storage.presign(opts);
  }

  // -------------------- Express middleware --------------------
  single(fieldName: string) {
    return async (req: any, res: any, next: (err?: unknown) => void): Promise<void> => {
      try {
        const files = await this.handleNodeRequest(req, { single: fieldName });
        req.file = files[0];
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  array(fieldName: string, maxCount?: number) {
    return async (req: any, _res: any, next: (err?: unknown) => void): Promise<void> => {
      try {
        const files = await this.handleNodeRequest(req, { array: fieldName, maxCount });
        req.files = files;
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  // -------------------- Generic fetch Request handler --------------------
  handler() {
    return async (request: Request): Promise<{ files: UploadedFile[] }> => {
      const contentType = request.headers.get("content-type") ?? "";
      const boundary = getBoundary(contentType);
      if (!boundary) throw new UploadError("Missing multipart boundary");
      const body = request.body;
      if (!body) throw new UploadError("Missing request body");
      const nodeStream = webStreamToNode(body);
      const files = await this.consumeMultipart(nodeStream, boundary, request);
      return { files };
    };
  }

  // -------------------- Hono middleware --------------------
  hono() {
    return async (c: any, next: () => Promise<void>) => {
      const result = await this.handler()(c.req.raw as Request);
      c.set("uploadedFiles", result.files);
      await next();
    };
  }

  // -------------------- Fastify plugin --------------------
  fastify() {
    return async (instance: any) => {
      instance.addContentTypeParser(
        "multipart/form-data",
        { parseAs: "buffer" },
        async (req: any, payload: Buffer) => {
          const boundary = getBoundary(req.headers["content-type"]);
          if (!boundary) throw new UploadError("Missing multipart boundary");
          const stream = Readable.from(payload);
          return { files: await this.consumeMultipart(stream, boundary, req) };
        },
      );
    };
  }

  // -------------------- Next.js App Router --------------------
  nextjs() {
    return async (request: Request): Promise<Response> => {
      const result = await this.handler()(request);
      return new Response(JSON.stringify({ files: result.files }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
  }

  // -------------------- Core --------------------
  private async handleNodeRequest(
    req: RequestLike & AsyncIterable<Uint8Array>,
    opts: { single?: string; array?: string; maxCount?: number },
  ): Promise<UploadedFile[]> {
    const contentType = (req.headers["content-type"] as string) ?? "";
    const boundary = getBoundary(contentType);
    if (!boundary) throw new UploadError("Missing multipart boundary");
    const files = await this.consumeMultipart(req as unknown as Readable, boundary, req);
    const allowed = (opts.single ?? opts.array)!;
    const matched = files.filter((f) => f.fieldName === allowed);
    if (opts.single) {
      if (matched.length === 0) throw new UploadError(`Expected file under field "${allowed}"`);
      return [matched[0]!];
    }
    if (opts.maxCount && matched.length > opts.maxCount) {
      throw new UploadError(
        `Too many files for field "${allowed}" (got ${matched.length}, max ${opts.maxCount})`,
      );
    }
    return matched;
  }

  private async consumeMultipart(
    body: Readable | AsyncIterable<Uint8Array>,
    boundary: string,
    req: unknown,
  ): Promise<UploadedFile[]> {
    const limits = this.options.limits ?? {};
    const files: UploadedFile[] = [];
    let fileCount = 0;

    for await (const part of parseMultipart(body, boundary)) {
      if (part.type !== "file") continue;
      fileCount += 1;
      if (limits.files && fileCount > limits.files) {
        throw new UploadError(`Too many files (max ${limits.files})`, 413);
      }

      const safeOriginal = sanitizeFilename(part.filename);
      const filename = appendUuidSuffix(safeOriginal);
      await this.options.hooks?.onUploadStart?.({ filename, mimeType: part.mimeType }, req);

      const validated = await this.validateAndPipe(part, filename, limits);

      const stored = await this.options.storage.upload({
        stream: validated.stream,
        filename,
        mimeType: validated.mimeType,
      });

      const result: UploadedFile = {
        fieldName: part.fieldName,
        filename,
        originalName: part.filename,
        mimeType: validated.mimeType,
        size: stored.size,
        storageKey: stored.key,
        ...(stored.url !== undefined ? { url: stored.url } : {}),
        metadata: {},
      };
      await this.options.hooks?.onUploadComplete?.(result, req);
      files.push(result);
    }
    return files;
  }

  private async validateAndPipe(
    part: MultipartFilePart,
    filename: string,
    limits: NonNullable<UpflowOptions["limits"]>,
  ): Promise<{ stream: Readable; mimeType: string }> {
    const out = new PassThrough();
    const maxSize = limits.fileSize ?? Number.MAX_SAFE_INTEGER;
    let received = 0;
    let detected = part.mimeType;
    let head = Buffer.alloc(0);
    let validated = false;

    part.stream.on("error", (err) => out.destroy(err));
    part.stream.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxSize) {
        const err = new FileTooLargeError(maxSize);
        out.destroy(err);
        part.stream.destroy(err);
        return;
      }
      if (!validated) {
        head = Buffer.concat([head, chunk]);
        if (head.length >= 16) {
          const sniffed = detectMimeFromBytes(head);
          if (sniffed) detected = sniffed;
          if (!mimeMatchesAllowed(detected, limits.allowedMimeTypes)) {
            const err = new InvalidMimeTypeError(detected, limits.allowedMimeTypes ?? []);
            out.destroy(err);
            part.stream.destroy(err);
            return;
          }
          validated = true;
          out.write(head);
          head = Buffer.alloc(0);
          return;
        }
        return;
      }
      out.write(chunk);
      this.emit("progress", {
        filename,
        bytesReceived: received,
        bytesTotal: null,
        percent: null,
      } as ProgressEvent);
    });
    part.stream.on("end", () => {
      if (!validated && head.length > 0) {
        const sniffed = detectMimeFromBytes(head) ?? detected;
        if (!mimeMatchesAllowed(sniffed, limits.allowedMimeTypes)) {
          out.destroy(new InvalidMimeTypeError(sniffed, limits.allowedMimeTypes ?? []));
          return;
        }
        detected = sniffed;
        out.write(head);
      }
      out.end();
    });
    part.stream.on("close", () => {
      if (!part.stream.readableEnded) out.destroy(new UploadAbortedError());
    });

    return { stream: out, mimeType: detected };
  }
}

export function upflow(options: UpflowOptions): Upflow {
  return new Upflow(options);
}
