# Changelog

## [0.1.0] — 2026-05-15

### Added

- `parseStream(body, { provider })` normalizes OpenAI, Anthropic, Gemini, Groq, DeepSeek, and Ollama SSE into a single `StreamChunk` union.
- `collectStream`, `teeStream`, `streamToText`, and header-based `detectProvider`.
- Tree-shakable provider sub-paths: `llm-stream/providers/<name>`.
- Zero runtime dependencies.
