# Changelog

## [0.1.0] — 2026-05-15

### Added

- `CostLimiter` with per-user, per-team, per-api-key, and global dollar budgets.
- Minute, hour, day, and month windows with hard limits and soft `BudgetWarning` events at 80%.
- Pluggable storage: `MemoryCostStorage`, `RedisCostStorage`.
- Pricing snapshot for major OpenAI, Anthropic, Google, Mistral, and Groq models with override hook.
- Client wrappers: `wrap(openai)`, `wrapAnthropic(anthropic)`.
