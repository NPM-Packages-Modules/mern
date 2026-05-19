# Changelog

## [0.1.0] — 2026-05-15

### Added

- `Upflow` class with Express, Hono, Fastify, and Next.js App Router adapters.
- Pluggable storage: `DiskStorage`, `S3Storage`, `R2Storage`, `MemoryStorage`.
- Magic-byte MIME validation, filename sanitization, size limits, and progress hooks.
- Built-in SigV4 signer when no `@aws-sdk/client-s3` is available.
