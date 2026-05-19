# Changelog

## [0.1.0] — 2026-05-15

### Added

- Zod-validated `createEnv({ server, client, clientPrefix, runtimeEnv })` with read-only proxy and client/server isolation.
- Framework adapters: `envy/next`, `envy/vite`, `envy/astro`.
- CLI: `envy validate` and `envy generate-example` for `.env.example` scaffolding.
