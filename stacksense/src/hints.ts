import type { ParsedError } from "./types.js";

type HintRule = { match: RegExp; hint: string; fix?: string };

const RULES: HintRule[] = [
  {
    match: /cannot read propert(y|ies) of (undefined|null) \(reading '(.+?)'\)/i,
    hint: "Accessing a property on an undefined/null value. Add a null/undefined check before use.",
    fix: "Use optional chaining: object?.property",
  },
  {
    match: /econnrefused/i,
    hint: "A network connection was refused. The target service is unreachable.",
    fix: "Verify the host/port and that the dependency (DB, Redis, API) is running.",
  },
  {
    match: /etimedout/i,
    hint: "Network call timed out. Slow upstream or network partition.",
    fix: "Increase the client timeout, add retries, and check upstream latency.",
  },
  {
    match: /timeout|timed out/i,
    hint: "Operation timed out.",
    fix: "Reduce work per call, add caching, or raise the timeout.",
  },
  {
    match: /MongoServerSelectionError|MongoNetworkError/i,
    hint: "MongoDB driver could not reach a server.",
    fix: "Check MONGODB_URI, network rules, and that the cluster is up.",
  },
  {
    match: /duplicate key error|E11000/i,
    hint: "MongoDB unique constraint violation.",
    fix: "Catch the duplicate key error and surface a 409 Conflict to the client.",
  },
  {
    match: /validation failed/i,
    hint: "Schema validation failed.",
    fix: "Validate input with zod/joi before hitting the DB.",
  },
  {
    match: /JsonWebTokenError|jwt malformed|invalid signature|jwt expired/i,
    hint: "JWT problem: token missing, malformed, or expired.",
    fix: "Return 401 and prompt the client to re-authenticate.",
  },
  {
    match: /CORS|cross-origin/i,
    hint: "CORS rejection.",
    fix: "Add the requesting origin to your CORS allowlist or use the cors() middleware.",
  },
  {
    match: /payload too large|request entity too large/i,
    hint: "Body exceeded the configured limit.",
    fix: "Raise the body-parser limit (`express.json({ limit: '5mb' })`) or stream large uploads.",
  },
  {
    match: /SyntaxError.*JSON/i,
    hint: "Invalid JSON in the request or response body.",
    fix: "Wrap JSON.parse in a try/catch and return a 400 with details.",
  },
  {
    match: /ENOENT/i,
    hint: "File or directory not found.",
    fix: "Check the path resolution and ensure the file exists at runtime.",
  },
  {
    match: /EADDRINUSE/i,
    hint: "Port already in use.",
    fix: "Free the port or configure a different one via env var.",
  },
];

export function deriveHints(err: ParsedError): { hints: string[]; suggestedFix?: string } {
  const haystack = `${err.name}: ${err.message}`;
  const hints: string[] = [];
  let suggestedFix: string | undefined;
  for (const r of RULES) {
    if (r.match.test(haystack)) {
      hints.push(r.hint);
      if (!suggestedFix && r.fix) suggestedFix = r.fix;
    }
  }
  if (err.code) hints.push(`Error code: ${err.code}`);
  if (err.cause) hints.push(`Triggered by: ${err.cause.name}: ${err.cause.message}`);
  return { hints, suggestedFix };
}
