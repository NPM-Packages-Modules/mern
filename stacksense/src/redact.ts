const DEFAULTS = [
  "password",
  "pass",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "session",
  "ssn",
  "creditcard",
  "credit_card",
  "cvv",
];

export function buildRedactor(extraKeys: string[] = []): (input: unknown) => unknown {
  const keys = new Set([...DEFAULTS, ...extraKeys].map((k) => k.toLowerCase()));

  function redact(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);
    if (Array.isArray(value)) return value.map((v) => redact(v, seen));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keys.has(k.toLowerCase()) ? "[REDACTED]" : redact(v, seen);
    }
    return out;
  }

  return (input) => redact(input, new WeakSet());
}
