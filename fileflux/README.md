# fileflux

[![npm version](https://img.shields.io/npm/v/fileflux.svg)](https://www.npmjs.com/package/fileflux)
[![bundle size](https://img.shields.io/bundlephobia/minzip/fileflux)](https://bundlephobia.com/package/fileflux)
[![license](https://img.shields.io/npm/l/fileflux.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Multer hasn't had a major release since 2019.** No S3 streaming. No TypeScript. No chunked uploads. No Hono. `fileflux` is what Multer should have become — a modern, type-safe upload handler for **Express, Hono, Fastify, and Next.js App Router** with **direct streaming to S3/R2**, **multipart uploads**, **presigned URLs**, **MIME-byte validation**, and **progress events**.

---

## Installation

```bash
npm install fileflux
pnpm add fileflux
yarn add fileflux
# Optional for S3:
npm install @aws-sdk/client-s3
```

---

## Quick Start

```ts
import express from "express";
import { fileflux, DiskStorage } from "fileflux";

const upload = fileflux({
  storage: new DiskStorage({ root: "./uploads" }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const app = express();
app.post("/upload", upload.single("file"), (req: any, res) => {
  res.json(req.file);
});
app.listen(3000);
```

---

## Core Usage Examples

### 1. Single file upload to disk with Express

```ts
import express from "express";
import { fileflux, DiskStorage } from "fileflux";

const upload = fileflux({ storage: new DiskStorage({ root: "./uploads" }) });

const app = express();
app.post("/upload", upload.single("file"), (req: any, res) => res.json(req.file));
```

### 2. Multiple file upload to S3

```ts
import express from "express";
import { S3Client } from "@aws-sdk/client-s3";
import { fileflux, S3Storage } from "fileflux";

const upload = fileflux({
  storage: new S3Storage({
    bucket: "uploads",
    region: "us-east-1",
    client: new S3Client({ region: "us-east-1" }),
  }),
});

const app = express();
app.post("/upload", upload.array("files", 5), (req: any, res) => res.json(req.files));
```

### 3. Validate type and size

```ts
import { fileflux, DiskStorage, FileTooLargeError, InvalidMimeTypeError } from "fileflux";

const upload = fileflux({
  storage: new DiskStorage({ root: "./uploads" }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
});

app.post("/upload", upload.single("photo"), (_req, res) => res.json({ ok: true }), (err: any, _req: any, res: any, _next: any) => {
  if (err instanceof FileTooLargeError) return res.status(413).json({ error: "too large" });
  if (err instanceof InvalidMimeTypeError) return res.status(415).json({ error: "bad mime" });
  res.status(500).json({ error: "upload failed" });
});
```

### 4. Track upload progress

```ts
import { fileflux, DiskStorage } from "fileflux";

const upload = fileflux({ storage: new DiskStorage({ root: "./uploads" }) });
upload.on("progress", (e) => {
  console.log(`${e.filename}: ${e.bytesReceived} bytes`);
});
```

### 5. Presigned URLs for direct browser upload

```ts
import { fileflux, S3Storage } from "fileflux";

const upload = fileflux({
  storage: new S3Storage({
    bucket: "uploads",
    region: "us-east-1",
    accessKeyId: process.env.AWS_KEY!,
    secretAccessKey: process.env.AWS_SECRET!,
  }),
});

app.post("/presign", express.json(), async (req, res) => {
  const result = await upload.presign({
    filename: req.body.filename,
    contentType: req.body.contentType,
    maxSizeBytes: 50 * 1024 * 1024,
    expiresInSeconds: 600,
  });
  res.json(result);
});
```

### 6. MemoryStorage for tests

```ts
import { describe, it, expect } from "vitest";
import { fileflux, MemoryStorage } from "fileflux";

it("uploads", async () => {
  const storage = new MemoryStorage();
  const upload = fileflux({ storage });
  // ... drive `upload.handler()` with a fetch Request and assert
});
```

---

## Framework Integration Examples

### Express

```ts
import express from "express";
import { fileflux, DiskStorage } from "fileflux";

const upload = fileflux({ storage: new DiskStorage({ root: "./uploads" }) });

const app = express();
app.post("/single", upload.single("file"), (req: any, res) => res.json(req.file));
app.post("/multiple", upload.array("files", 5), (req: any, res) => res.json(req.files));
```

### Hono (Cloudflare R2)

```ts
import { Hono } from "hono";
import { fileflux, R2Storage } from "fileflux";

const upload = fileflux({
  storage: new R2Storage({
    accountId: "your-account",
    bucket: "uploads",
    accessKeyId: process.env.R2_KEY!,
    secretAccessKey: process.env.R2_SECRET!,
  }),
});

const app = new Hono();
app.post("/upload", upload.hono(), (c) => c.json({ files: c.get("uploadedFiles") }));
```

### Fastify

```ts
import Fastify from "fastify";
import { fileflux, DiskStorage } from "fileflux";

const fastify = Fastify();
const upload = fileflux({ storage: new DiskStorage({ root: "./uploads" }) });
await upload.fastify()(fastify);

fastify.post("/upload", async (req) => (req.body as { files: unknown[] }).files);
```

### Next.js App Router

```ts
// app/api/upload/route.ts
import { fileflux, S3Storage } from "fileflux";

const upload = fileflux({
  storage: new S3Storage({
    bucket: "uploads",
    region: "us-east-1",
    accessKeyId: process.env.AWS_KEY!,
    secretAccessKey: process.env.AWS_SECRET!,
  }),
});

export const POST = upload.nextjs();
```

---

## Storage Adapter Reference

### DiskStorage

| Option            | Type     | Default                              | Description                |
| ----------------- | -------- | ------------------------------------ | -------------------------- |
| `root`            | `string` | —                                    | Root upload directory      |
| `pathTemplate`    | `string` | `"{date}/{uuid}-{filename}"`         | Variables: `date`, `uuid`, `filename`, `ext` |
| `publicUrlPrefix` | `string?`| `undefined`                          | If set, files get a `url`  |

### S3Storage

| Option              | Type      | Default                                  | Description                                |
| ------------------- | --------- | ---------------------------------------- | ------------------------------------------ |
| `bucket`            | `string`  | —                                        | Bucket name                                |
| `region`            | `string`  | —                                        | AWS region                                 |
| `endpoint`          | `string`  | `https://s3.<region>.amazonaws.com`      | For custom S3-compatible providers         |
| `accessKeyId`       | `string?` | env credentials                          | When `client` is not provided              |
| `secretAccessKey`   | `string?` | env credentials                          | When `client` is not provided              |
| `partSize`          | `number`  | `8388608` (8 MB)                         | Multipart part size                        |
| `multipartThreshold`| `number`  | `5242880` (5 MB)                         | Files larger than this use multipart       |
| `publicUrlPrefix`   | `string?` | `undefined`                              | CDN/public URL prefix                      |
| `client`            | `S3Client?` | `undefined`                            | Optional `@aws-sdk/client-s3` instance     |

### R2Storage

Same as `S3Storage` plus `accountId`. Region defaults to `"auto"`; endpoint defaults to `https://<accountId>.r2.cloudflarestorage.com`.

### MemoryStorage

No options. Useful in tests. Exposes `read(key)`, `list()`, `clear()`.

---

## Error Handling

```ts
import {
  UploadError,
  FileTooLargeError,
  InvalidMimeTypeError,
  StorageError,
  UploadAbortedError,
} from "fileflux";

app.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof FileTooLargeError) return res.status(413).json({ error: err.message });
  if (err instanceof InvalidMimeTypeError) return res.status(415).json({ error: err.message });
  if (err instanceof StorageError) return res.status(500).json({ error: "storage failed" });
  if (err instanceof UploadAbortedError) return res.status(499).end();
  if (err instanceof UploadError) return res.status(err.status).json({ error: err.message });
  next(err);
});
```

---

## TypeScript Types

```ts
import type {
  UploadedFile,
  UploadOptions,
  StorageAdapter,
  ProgressEvent,
  PresignResult,
  PresignOptions,
} from "fileflux";

class GcsStorage implements StorageAdapter {
  async upload(input: { stream: NodeJS.ReadableStream; filename: string; mimeType: string }) {
    return { key: "...", size: 0 };
  }
}
```

---

## Security Hardening

`fileflux` ships with the following defaults:

- **Path traversal prevention** — `..`, backslashes, control characters stripped
- **MIME spoofing protection** — `Content-Type` ignored when bytes disagree
- **Filename sanitization** — UUID suffix prevents collision-based overwrites
- **Per-request limits** — `fileSize`, `files`, `allowedMimeTypes`
- **Aborted streams** raise `UploadAbortedError`

Recommended additions:

- Rate-limit upload endpoints with `express-rate-limit` or your gateway
- Cap concurrent uploads per IP with `p-limit`
- Run uploads through a virus scanner in `onUploadComplete` for user-generated content
- Set a strong `Content-Security-Policy` on the page making cross-origin uploads

---

## Real-World Recipe — Full Image Upload Service

```ts
import { Hono } from "hono";
import sharp from "sharp";
import { fileflux, R2Storage } from "fileflux";

const r2 = new R2Storage({
  accountId: process.env.R2_ACCOUNT_ID!,
  bucket: "img",
  accessKeyId: process.env.R2_KEY!,
  secretAccessKey: process.env.R2_SECRET!,
  publicUrlPrefix: "https://cdn.example.com",
});

const upload = fileflux({
  storage: r2,
  limits: {
    fileSize: 20 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  hooks: {
    async onUploadComplete(file) {
      const buffer = Buffer.alloc(0); // pulled from r2.get(file.storageKey)
      const thumb = await sharp(buffer).resize(300).webp().toBuffer();
      // write thumb to a `${file.storageKey}.thumb.webp` key (omitted for brevity)
      console.log("thumb ready for", file.storageKey);
    },
  },
});

const app = new Hono();
app.post("/upload", upload.hono(), (c) => {
  const files = c.get("uploadedFiles");
  return c.json({ files });
});
```

```html
<!-- React frontend (presigned URL flow) -->
<input id="file" type="file" />
<script type="module">
  document.getElementById("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const { url, fields, storageKey } = await fetch("/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    }).then((r) => r.json());

    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("file", file);
    await fetch(url, { method: "POST", body: fd });
    console.log("uploaded as", storageKey);
  });
</script>
```

---

## Migration Guide from Multer

```diff
- import multer from "multer";
+ import { fileflux, DiskStorage } from "fileflux";

- const upload = multer({ dest: "./uploads" });
+ const upload = fileflux({ storage: new DiskStorage({ root: "./uploads" }) });

  app.post("/", upload.single("file"), (req, res) => res.json(req.file));
```

For S3:

```diff
- import multer from "multer";
- import multerS3 from "multer-s3";
- const upload = multer({ storage: multerS3({ s3, bucket: "x" }) });
+ import { S3Client } from "@aws-sdk/client-s3";
+ import { fileflux, S3Storage } from "fileflux";
+ const upload = fileflux({ storage: new S3Storage({ bucket: "x", region: "us-east-1", client: new S3Client({ region: "us-east-1" }) }) });
```

---

## Comparison Table

| Feature                       | Multer | Formidable | **fileflux** |
| ----------------------------- | :----: | :--------: | :--------: |
| TypeScript types              |   ⚠️   |     ⚠️     |     ✅     |
| S3 / R2 streaming             |   ❌   |     ❌     |     ✅     |
| Multipart upload (>5 MB)      |   ❌   |     ❌     |     ✅     |
| Presigned URLs                |   ❌   |     ❌     |     ✅     |
| Hono / Fastify adapters       |   ❌   |     ❌     |     ✅     |
| MIME validation from bytes    |   ❌   |     ❌     |     ✅     |
| Progress events               |   ⚠️   |     ✅     |     ✅     |

---

## License

MIT
