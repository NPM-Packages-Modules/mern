import { S3Storage, type S3StorageOptions } from "./s3.js";

export interface R2StorageOptions extends Omit<S3StorageOptions, "region"> {
  accountId: string;
}

/** Cloudflare R2 — S3-compatible API behind a per-account endpoint. */
export class R2Storage extends S3Storage {
  constructor(opts: R2StorageOptions) {
    super({
      ...opts,
      region: "auto",
      endpoint: opts.endpoint ?? `https://${opts.accountId}.r2.cloudflarestorage.com`,
    });
  }
}
