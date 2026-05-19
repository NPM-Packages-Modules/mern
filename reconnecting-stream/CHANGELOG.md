# Changelog

## [0.1.0] — 2026-05-15

### Added

- `ReconnectingSSE` and `ReconnectingWebSocket` clients with full-jitter exponential backoff.
- Configurable heartbeat detection, `Last-Event-ID` resume, and bounded message queue while disconnected.
- Typed event emitter (`open`, `message`, `state`, `reconnect`, `error`, `close`).
- Browser and Node.js compatible, zero runtime dependencies.
