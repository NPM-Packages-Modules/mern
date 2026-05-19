# picsmith

[![npm version](https://img.shields.io/npm/v/picsmith.svg)](https://www.npmjs.com/package/picsmith)
[![bundle size](https://img.shields.io/bundlephobia/minzip/picsmith)](https://bundlephobia.com/package/picsmith)
[![license](https://img.shields.io/npm/l/picsmith.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**Cloudinary-style image optimization, self-hosted, in any Node.js server.** Cloudinary starts at $89/month. Next.js Image Optimization only works in Next.js. `picsmith` is a zero-config middleware powered by `sharp` that delivers on-the-fly resizing, AVIF/WebP conversion, smart cropping, blur placeholders, and EXIF stripping via URL parameters — `?w=800&h=600&format=webp&fit=cover&q=80`.

---

## Installation

```bash
npm install picsmith sharp
pnpm add picsmith sharp
yarn add picsmith sharp
```

---

## Quick Start

```ts
import express from "express";
import { picsmith } from "picsmith";

const app = express();
app.use("/images", picsmith({ source: "./uploads", cache: "./cache", maxAge: 86400 }));
app.listen(3000);
// GET /images/photo.jpg?w=800&format=webp&q=80
```

---

## Core Usage Examples

### 1. Serve resized WebP from a local folder

```ts
import express from "express";
import { picsmith } from "picsmith";

const app = express();
app.use("/img", picsmith({ source: "./public/img", cache: "./.picsmith-cache" }));
```

### 2. AVIF on the fly

```ts
// GET /img/photo.jpg?format=avif&q=60
```

### 3. Blur placeholder

```ts
// GET /img/photo.jpg?placeholder=blur
// → 8x8 WebP, perfect for `data:` URI in a LQIP setup
```

### 4. Smart entropy-based crop

```ts
// GET /img/photo.jpg?w=300&h=300&fit=cover&gravity=smart
```

### 5. Strip EXIF from user uploads

```ts
// GET /img/user-upload.jpg?strip=true
```

### 6. format=auto with Accept negotiation

```ts
// GET /img/photo.jpg?w=800&format=auto
//   Chrome with AVIF support  → image/avif
//   Older browsers            → image/jpeg
```

---

## Framework Integration Examples

### Express

```ts
import express from "express";
import { picsmith } from "picsmith";

const app = express();
app.use("/images", picsmith({
  source: "./uploads",
  cache: "./cache",
  maxAge: 60 * 60 * 24 * 7,
}));
```

### Hono (Cloudflare R2 source adapter)

```ts
import { Hono } from "hono";
import { imagoHono, type SourceAdapter } from "picsmith";

class R2Source implements SourceAdapter {
  async fetch(key: string) {
    const obj = await env.R2.get(key);
    if (!obj) return undefined;
    const buffer = Buffer.from(await obj.arrayBuffer());
    return { buffer, mimeType: obj.httpMetadata?.contentType ?? "application/octet-stream" };
  }
}

const app = new Hono();
app.get("/images/*", imagoHono({ source: new R2Source(), maxAge: 3600 }));
```

### Fastify

```ts
import Fastify from "fastify";
import { imagoFastify } from "picsmith";

const fastify = Fastify();
fastify.get("/img/*", imagoFastify({ source: "./public/img", cache: "./cache" }));
```

### Standalone pipeline (build step)

```ts
import { readFile, writeFile } from "node:fs/promises";
import { transform } from "picsmith";

const buf = await readFile("./photo.jpg");
const out = await transform({ source: buf, options: { w: 800, format: "webp", q: 80 } });
await writeFile("./photo-800.webp", out.buffer);
```

---

## Transform Reference

| Parameter      | Type / Values                                                | Default   | Description                                  |
| -------------- | ------------------------------------------------------------ | --------- | -------------------------------------------- |
| `w`            | 1-4000                                                       | —         | Output width                                 |
| `h`            | 1-4000                                                       | —         | Output height                                |
| `fit`          | `cover` `contain` `fill` `inside` `outside`                  | `cover`   | Resize strategy                              |
| `format`       | `jpeg` `png` `webp` `avif` `auto`                            | `auto`    | Output format                                |
| `q`            | 1-100                                                        | format-default | Quality                                  |
| `blur`         | 0.3-1000                                                     | —         | Gaussian sigma                               |
| `gravity`      | `center` `north` `south` `east` `west` `smart`               | `center`  | Crop anchor; `smart` uses sharp's `attention` |
| `strip`        | bool                                                         | `false`   | Strip EXIF                                   |
| `sharpen`      | bool                                                         | `false`   | Apply default sharpen                        |
| `placeholder`  | `blur`                                                       | —         | Return 8×8 WebP blur LQIP                    |

---

## Error Handling

```ts
import { ImagoError, DimensionLimitError, UnsupportedFormatError, SourceNotFoundError } from "picsmith";

app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof DimensionLimitError) return res.status(413).json({ error: err.message });
  if (err instanceof UnsupportedFormatError) return res.status(400).json({ error: err.message });
  if (err instanceof SourceNotFoundError) return res.status(404).json({ error: err.message });
  if (err instanceof ImagoError) return res.status(err.status).json({ error: err.message });
  res.status(500).end();
});
```

---

## TypeScript Types

```ts
import type {
  ImagoOptions,
  TransformOptions,
  CacheOptions,
  SourceAdapter,
  Format,
  Fit,
  Gravity,
} from "picsmith";

class S3Source implements SourceAdapter {
  async fetch(key: string) {
    /* call S3 GetObject, return { buffer, mimeType } */
    return undefined;
  }
}
```

---

## Performance

Approx. benchmarks on an M2 laptop using `sharp` 0.33 and a 2 MB JPEG:

| Transform                        | Latency (cold) | Cache hit | Output size |
| -------------------------------- | -------------: | --------: | ----------: |
| WebP 800px (q=80)                |         ~38 ms |    ~1 ms  |        72 KB|
| AVIF 800px (q=65)                |        ~120 ms |    ~1 ms  |        49 KB|
| WebP 400px thumbnail             |         ~22 ms |    ~1 ms  |        24 KB|
| 8x8 blur placeholder             |          ~7 ms |    ~1 ms  |         300 B|

`sharp` is built on `libvips`; everything is done in native code with zero-copy buffer handling. The biggest performance win is the cache — a CDN in front of picsmith caches the output indefinitely (`Cache-Control: public, max-age=…, immutable`).

---

## Real-World Recipe — User Avatar Service

```ts
import express from "express";
import { picsmith } from "picsmith";
import { upflow, DiskStorage } from "upflow";

const upload = upflow({
  storage: new DiskStorage({ root: "./avatars" }),
  limits: { allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
});

const app = express();

app.post("/avatars", upload.single("file"), async (req: any, res) => {
  res.json({ key: req.file.storageKey });
});

app.use(
  "/avatars",
  picsmith({
    source: "./avatars",
    cache: "./avatar-cache",
    maxAge: 60 * 60 * 24 * 30,
    maxDimension: 1024,
  }),
);
// /avatars/2026-01-12/abc.jpg?w=40&format=webp&strip=true   ← thumbnail
// /avatars/2026-01-12/abc.jpg?w=160&format=webp&strip=true  ← profile
// /avatars/2026-01-12/abc.jpg?w=400&format=webp&strip=true  ← full
// /avatars/2026-01-12/abc.jpg?placeholder=blur              ← LQIP

app.listen(3000);
```

---

## Deployment Guide

### Behind nginx

```nginx
location /images/ {
  proxy_pass http://app:3000;
  proxy_cache imago_cache;
  proxy_cache_valid 200 7d;
  proxy_cache_key "$request_uri";
  add_header X-Cache-Status $upstream_cache_status;
}
```

### CDN

`picsmith` already sets `Cache-Control: public, max-age=…, immutable` plus `ETag` and `Last-Modified` headers. Cloudflare, Fastly, or Vercel Edge will cache transforms forever — invalidating only when source mtime changes (because `picsmith` includes mtime in the cache key, the URL changes).

### Docker

```dockerfile
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libvips-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "dist/index.js"]
```

The `sharp` native binary is platform-specific; install with `--include=optional` to make sure `libvips` is fetched.

---

## Comparison Table

| Feature                    | Cloudinary | Next.js Image | sharp (raw) | **picsmith** |
| -------------------------- | :--------: | :-----------: | :---------: | :-------: |
| Framework agnostic         |     ✅     |       ❌      |      ✅     |     ✅    |
| On-the-fly transforms      |     ✅     |       ✅      |      DIY    |     ✅    |
| URL-driven API             |     ✅     |       ⚠️      |      ❌     |     ✅    |
| Self-hosted                |     ❌     |       ✅      |      ✅     |     ✅    |
| AVIF support               |     ✅     |       ✅      |      ✅     |     ✅    |
| Smart crop (entropy)       |     ✅     |       ❌      |      ✅     |     ✅    |
| Blur placeholder           |     ✅     |       ✅      |      DIY    |     ✅    |
| Free                       |     ❌     |       ⚠️      |      ✅     |     ✅    |

---

## License

MIT
