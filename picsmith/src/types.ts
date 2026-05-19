import { z } from "zod";

export const FORMATS = ["jpeg", "png", "webp", "avif", "auto"] as const;
export type Format = (typeof FORMATS)[number];

export const FITS = ["cover", "contain", "fill", "inside", "outside"] as const;
export type Fit = (typeof FITS)[number];

export const GRAVITIES = ["center", "north", "south", "east", "west", "smart"] as const;
export type Gravity = (typeof GRAVITIES)[number];

export const TransformOptionsSchema = z.object({
  w: z.coerce.number().int().min(1).max(4000).optional(),
  h: z.coerce.number().int().min(1).max(4000).optional(),
  fit: z.enum(FITS).default("cover"),
  format: z.enum(FORMATS).default("auto"),
  q: z.coerce.number().int().min(1).max(100).optional(),
  blur: z.coerce.number().min(0.3).max(1000).optional(),
  gravity: z.enum(GRAVITIES).default("center"),
  strip: z.coerce.boolean().default(false),
  sharpen: z.coerce.boolean().default(false),
  placeholder: z.enum(["blur"]).optional(),
});
export type TransformOptions = z.infer<typeof TransformOptionsSchema>;

export interface SourceAdapter {
  fetch(key: string): Promise<{ buffer: Buffer; mimeType: string } | undefined>;
}

export interface CacheOptions {
  dir?: string;
  maxItems?: number;
}

export interface ImagoOptions {
  source: string | SourceAdapter;
  cache?: string | CacheOptions;
  maxAge?: number;
  /** Maximum returned width or height. */
  maxDimension?: number;
}
