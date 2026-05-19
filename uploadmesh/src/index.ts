export interface UploadFileLike {
  size: number;
  mimetype: string;
  originalname?: string;
}

export interface UploadValidation {
  maxBytes: number;
  allowedMime: string[];
}

export type UploadValidationResult = { ok: true } | { ok: false; error: "size" | "mime" | "name" };

export function validateUpload(file: UploadFileLike, rules: UploadValidation): UploadValidationResult {
  if (file.size > rules.maxBytes) return { ok: false, error: "size" };
  if (!rules.allowedMime.includes(file.mimetype)) return { ok: false, error: "mime" };
  return { ok: true };
}

export interface ChunkDescriptor {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  objectKey: string;
}

/** Deterministic placeholder URL for presigned PUT (implement signing with AWS SDK in your service). */
export function buildUnsignedPutUrl(bucket: string, key: string, endpoint = "https://s3.amazonaws.com"): string {
  const safeKey = encodeURIComponent(key).replace(/%2F/g, "/");
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${safeKey}`;
}

export function storageProfile(provider: "s3" | "r2" | "local", bucket: string): { provider: string; bucket: string } {
  return { provider, bucket };
}
