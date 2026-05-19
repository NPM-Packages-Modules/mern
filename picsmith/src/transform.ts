import { createHash } from "node:crypto";
import { DimensionLimitError, UnsupportedFormatError } from "./errors.js";
import {
  type Format,
  type TransformOptions,
  TransformOptionsSchema,
} from "./types.js";

type SharpInstance = {
  metadata(): Promise<{ width?: number; height?: number; format?: string }>;
  resize(opts: Record<string, unknown>): SharpInstance;
  rotate(): SharpInstance;
  blur(sigma: number): SharpInstance;
  sharpen(): SharpInstance;
  withMetadata(): SharpInstance;
  toFormat(fmt: string, opts: Record<string, unknown>): SharpInstance;
  toBuffer(): Promise<Buffer>;
};

let _sharp: ((buffer: Buffer | Uint8Array) => SharpInstance) | undefined;

async function loadSharp() {
  if (!_sharp) {
    try {
      const mod = (await import(/* @vite-ignore */ "sharp")) as unknown as {
        default: (buffer: Buffer | Uint8Array) => SharpInstance;
      };
      _sharp = mod.default;
    } catch (err) {
      throw new Error(
        "imago requires `sharp >= 0.33.0` as a peer dependency. Install it with `npm install sharp`.",
      );
    }
  }
  return _sharp!;
}

const QUALITY_DEFAULTS: Record<string, number> = {
  jpeg: 82,
  webp: 80,
  avif: 65,
  png: 90,
};

export function pickFormat(requested: Format, accept: string | undefined, sourceFormat: string | undefined): Exclude<Format, "auto"> {
  if (requested !== "auto") return requested;
  const a = (accept ?? "").toLowerCase();
  if (a.includes("image/avif")) return "avif";
  if (a.includes("image/webp")) return "webp";
  if (sourceFormat === "png") return "png";
  return "jpeg";
}

export interface TransformResult {
  buffer: Buffer;
  mimeType: string;
  etag: string;
}

export interface TransformInput {
  source: Buffer;
  options: Partial<TransformOptions>;
  accept?: string;
  maxDimension?: number;
}

export async function transform(input: TransformInput): Promise<TransformResult> {
  const opts = TransformOptionsSchema.parse(input.options);
  const maxDim = input.maxDimension ?? 4000;
  if (opts.w && opts.w > maxDim) throw new DimensionLimitError(opts.w, maxDim);
  if (opts.h && opts.h > maxDim) throw new DimensionLimitError(opts.h, maxDim);

  const sharp = await loadSharp();
  let pipeline = sharp(input.source).rotate();

  const meta = await pipeline.metadata();
  const finalFormat = pickFormat(opts.format, input.accept, meta.format);

  if (!["jpeg", "png", "webp", "avif"].includes(finalFormat)) {
    throw new UnsupportedFormatError(finalFormat);
  }

  if (opts.placeholder === "blur") {
    const buf = await sharp(input.source)
      .resize({ width: 8, height: 8, fit: "cover" })
      .blur(2)
      .toFormat("webp", { quality: 50 })
      .toBuffer();
    return {
      buffer: buf,
      mimeType: "image/webp",
      etag: hashEtag(buf),
    };
  }

  if (opts.w || opts.h) {
    pipeline = pipeline.resize({
      ...(opts.w !== undefined ? { width: opts.w } : {}),
      ...(opts.h !== undefined ? { height: opts.h } : {}),
      fit: opts.fit,
      ...(opts.gravity === "smart" ? { position: "attention" } : { position: opts.gravity }),
    });
  }

  if (opts.blur !== undefined) pipeline = pipeline.blur(opts.blur);
  if (opts.sharpen) pipeline = pipeline.sharpen();
  if (!opts.strip) pipeline = pipeline.withMetadata();

  const quality = opts.q ?? QUALITY_DEFAULTS[finalFormat] ?? 80;
  pipeline = pipeline.toFormat(finalFormat, { quality });

  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    mimeType: `image/${finalFormat}`,
    etag: hashEtag(buffer),
  };
}

function hashEtag(buf: Buffer): string {
  return `"${createHash("md5").update(buf).digest("hex")}"`;
}
