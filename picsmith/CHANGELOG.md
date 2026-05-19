# Changelog

## [0.1.0] — 2026-05-15

### Added

- URL-driven `handle({ source, cache, maxAge }, key, query, headers)` with `w`, `h`, `fm`, `q`, `blur`, `gravity`, `fit` parameters.
- Sharp-powered transforms with LRU and disk caching, ETag, Last-Modified, and Cache-Control headers.
- Express, Hono, and Fastify middleware adapters.
- Strip-EXIF by default, max-dimension guard, and Accept-aware format negotiation.
