import { randomBytes } from "node:crypto";

export function generateTraceId(): string {
  const bytes = randomBytes(12).toString("hex");
  return `tr_${bytes}`;
}

export function pickTraceId(
  headers: Record<string, string | string[] | undefined>,
  headerName: string,
  generator: () => string,
): string {
  const raw = headers[headerName.toLowerCase()];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0] && raw[0].trim()) return raw[0].trim();
  return generator();
}
