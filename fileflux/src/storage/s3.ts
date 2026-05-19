import { Readable } from "node:stream";
import { randomUUID, createHmac, createHash } from "node:crypto";
import { sanitizeFilename } from "../util.js";
import { StorageError } from "../errors.js";
import type { PresignOptions, PresignResult, StorageAdapter } from "../types.js";

export interface S3StorageOptions {
  bucket: string;
  region: string;
  /** Required when not running in AWS Lambda / EC2. */
  accessKeyId?: string;
  secretAccessKey?: string;
  /** For R2 or custom endpoints. */
  endpoint?: string;
  /** Chunk size for multipart, default 8MB. Files smaller than `multipartThreshold` use a single PUT. */
  partSize?: number;
  multipartThreshold?: number;
  /** Public URL prefix to construct the returned URL. */
  publicUrlPrefix?: string;
  /** Optional `@aws-sdk/client-s3` client. If provided, that SDK is used; otherwise raw HTTP signatures are used. */
  client?: unknown;
}

const DEFAULT_PART_SIZE = 8 * 1024 * 1024;
const DEFAULT_THRESHOLD = 5 * 1024 * 1024;

export class S3Storage implements StorageAdapter {
  readonly bucket: string;
  readonly region: string;
  readonly endpoint: string;
  readonly partSize: number;
  readonly multipartThreshold: number;
  readonly publicUrlPrefix?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly client?: unknown;

  constructor(opts: S3StorageOptions) {
    this.bucket = opts.bucket;
    this.region = opts.region;
    this.endpoint = opts.endpoint ?? `https://s3.${opts.region}.amazonaws.com`;
    this.partSize = opts.partSize ?? DEFAULT_PART_SIZE;
    this.multipartThreshold = opts.multipartThreshold ?? DEFAULT_THRESHOLD;
    if (opts.publicUrlPrefix !== undefined) this.publicUrlPrefix = opts.publicUrlPrefix;
    if (opts.accessKeyId !== undefined) this.accessKeyId = opts.accessKeyId;
    if (opts.secretAccessKey !== undefined) this.secretAccessKey = opts.secretAccessKey;
    if (opts.client !== undefined) this.client = opts.client;
  }

  private buildKey(filename: string): string {
    const safe = sanitizeFilename(filename);
    return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safe}`;
  }

  private buildUrl(key: string): string | undefined {
    if (this.publicUrlPrefix) return `${this.publicUrlPrefix.replace(/\/$/, "")}/${key}`;
    return undefined;
  }

  async upload(input: { stream: Readable; filename: string; mimeType: string; size?: number }) {
    const key = this.buildKey(input.filename);
    if (this.client && hasSdk(this.client)) {
      try {
        await this.client.send(new (await loadCmd("PutObjectCommand"))({
          Bucket: this.bucket,
          Key: key,
          Body: input.stream,
          ContentType: input.mimeType,
        }));
      } catch (err) {
        throw new StorageError("S3 PutObject failed", err);
      }
      const url = this.buildUrl(key);
      const result: { key: string; url?: string; size: number } = { key, size: input.size ?? 0 };
      if (url) result.url = url;
      return result;
    }
    // Fallback: buffer + signed PUT. Production users should provide an `@aws-sdk/client-s3` client.
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of input.stream) {
      const b = Buffer.isBuffer(c) ? c : Buffer.from(c as Uint8Array);
      chunks.push(b);
      size += b.length;
    }
    const body = Buffer.concat(chunks);
    const url = `${this.endpoint}/${this.bucket}/${encodeURI(key)}`;
    const headers = await this.signRequest("PUT", url, body, input.mimeType);
    const res = await fetch(url, { method: "PUT", headers, body });
    if (!res.ok) throw new StorageError(`S3 PUT failed with ${res.status}`);
    const result: { key: string; url?: string; size: number } = { key, size };
    const publicUrl = this.buildUrl(key);
    if (publicUrl) result.url = publicUrl;
    return result;
  }

  async presign(opts: PresignOptions): Promise<PresignResult> {
    const key = this.buildKey(opts.filename);
    const expires = opts.expiresInSeconds ?? 600;
    const date = new Date();
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const credential = `${this.accessKeyId ?? ""}/${dateStamp}/${this.region}/s3/aws4_request`;
    const policy = Buffer.from(JSON.stringify({
      expiration: new Date(Date.now() + expires * 1000).toISOString(),
      conditions: [
        { bucket: this.bucket },
        ["starts-with", "$key", key.split("/")[0] ?? ""],
        { "content-type": opts.contentType },
        ["content-length-range", 0, opts.maxSizeBytes ?? 100 * 1024 * 1024],
        { "x-amz-credential": credential },
        { "x-amz-algorithm": "AWS4-HMAC-SHA256" },
        { "x-amz-date": amzDate },
      ],
    })).toString("base64");
    const signingKey = await this.getSigningKey(dateStamp);
    const signature = createHmac("sha256", signingKey).update(policy).digest("hex");
    return {
      url: `${this.endpoint}/${this.bucket}`,
      fields: {
        key,
        "Content-Type": opts.contentType,
        "x-amz-credential": credential,
        "x-amz-algorithm": "AWS4-HMAC-SHA256",
        "x-amz-date": amzDate,
        Policy: policy,
        "x-amz-signature": signature,
      },
      storageKey: key,
      expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    };
  }

  private async signRequest(method: string, url: string, body: Buffer, contentType: string) {
    const u = new URL(url);
    const date = new Date();
    const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonicalUri = u.pathname;
    const canonicalQuery = "";
    const canonicalHeaders =
      `content-type:${contentType}\nhost:${u.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalReq = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash("sha256").update(canonicalReq).digest("hex")}`;
    const signingKey = await this.getSigningKey(dateStamp);
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    return {
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      host: u.host,
    };
  }

  private async getSigningKey(dateStamp: string): Promise<Buffer> {
    const kDate = createHmac("sha256", `AWS4${this.secretAccessKey ?? ""}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(this.region).digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    return createHmac("sha256", kService).update("aws4_request").digest();
  }
}

interface AwsSdkClient {
  send(command: unknown): Promise<unknown>;
}

function hasSdk(client: unknown): client is AwsSdkClient {
  return typeof (client as { send?: unknown })?.send === "function";
}

async function loadCmd(name: "PutObjectCommand"): Promise<new (input: unknown) => unknown> {
  try {
    // @ts-expect-error optional peer dependency, resolved at runtime when used
    const mod = await import(/* @vite-ignore */ "@aws-sdk/client-s3");
    return (mod as Record<string, new (input: unknown) => unknown>)[name]!;
  } catch (err) {
    throw new StorageError(
      "@aws-sdk/client-s3 is required when passing a `client` to S3Storage; install it as a peer dependency.",
      err,
    );
  }
}
