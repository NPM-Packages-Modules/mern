import { createHash } from "node:crypto";
import { findOriginFrame } from "./parser.js";
import type { ParsedError, StackFrame } from "./types.js";

const NORMALIZE_QUOTES = /['"`][^'"`]{0,80}['"`]/g;
const NORMALIZE_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const NORMALIZE_HEX = /\b[0-9a-f]{16,}\b/gi;
const NORMALIZE_MIXED_TOKEN = /\b[a-z0-9_-]*\d[a-z0-9_-]*\b/gi;
const NORMALIZE_NUMBERS = /\b\d+(?:\.\d+)?\b/g;

function normalizeMessage(msg: string): string {
  return msg
    .replace(NORMALIZE_UUID, "<uuid>")
    .replace(NORMALIZE_HEX, "<hex>")
    .replace(NORMALIZE_QUOTES, "<str>")
    .replace(NORMALIZE_MIXED_TOKEN, "<id>")
    .replace(NORMALIZE_NUMBERS, "<n>")
    .toLowerCase()
    .trim();
}

function frameKey(frame: StackFrame | undefined): string {
  if (!frame) return "no-frame";
  const file = frame.file
    .replace(/\\/g, "/")
    .replace(/.*\/(src|dist|app|server|lib)\//, "$1/")
    .replace(/:\d+(:\d+)?$/, "");
  return `${frame.function}@${file}`;
}

export function fingerprintError(err: ParsedError): string {
  const origin = frameKey(findOriginFrame(err));
  const secondary = err.frames
    .filter((f) => f.inApp)
    .slice(1, 3)
    .map(frameKey)
    .join("|");
  const causeKey = err.cause ? `>${fingerprintError(err.cause)}` : "";
  const raw = `${err.name}::${normalizeMessage(err.message)}::${origin}::${secondary}${causeKey}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 12);
}
