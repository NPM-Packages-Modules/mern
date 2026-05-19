# Changelog

## [0.1.0] — 2026-05-15

### Added

- `scan`, `audit`, and `baseline` commands for npm supply-chain auditing.
- Detects curl-pipe-shell install scripts, base64+eval, network calls to untrusted domains, and obfuscated one-liners.
- Typosquat detection via Levenshtein distance to the top-1000 packages.
- Configurable risk levels in `.depguardrc.json` plus `.driftignore` support.
