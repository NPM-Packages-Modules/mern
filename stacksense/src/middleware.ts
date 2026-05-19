import { fingerprintError } from "./fingerprint.js";
import { deriveHints } from "./hints.js";
import { parseError } from "./parser.js";
import { buildRedactor } from "./redact.js";
import { InMemoryReporter } from "./reporter.js";
import { formatReport } from "./format.js";
import type {
  ErrorReport,
  ErrorReporter,
  ParsedError,
  RequestSnapshot,
  StacksenseOptions,
} from "./types.js";

type ReqLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};
type ResLike = {
  status(code: number): ResLike;
  json(body: unknown): ResLike;
  setHeader(name: string, value: string): void;
  headersSent?: boolean;
  locals?: Record<string, unknown>;
};
type NextLike = (err?: unknown) => void;
type ExpressErrorMiddleware = (err: unknown, req: ReqLike, res: ResLike, next: NextLike) => void;

interface StacksenseHandle {
  reporter: ErrorReporter;
  middleware: ExpressErrorMiddleware;
  inspect: (fingerprint: string) => ErrorReport | undefined;
  list: () => ReturnType<ErrorReporter["list"]>;
}

export function stacksense(options: StacksenseOptions = {}): ExpressErrorMiddleware {
  return createStacksense(options).middleware;
}

export function createStacksense(options: StacksenseOptions = {}): StacksenseHandle {
  const reporter = options.reporter ?? new InMemoryReporter();
  const redact = buildRedactor(options.redactKeys ?? []);
  const responseMode = options.responseMode ?? "rich";
  const hintEngine = options.hintEngine ?? ((err: ParsedError) => deriveHints(err).hints);

  const middleware: ExpressErrorMiddleware = (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    const status = options.statusMapper?.(err) ?? guessStatus(err);
    const parsed = parseError(err, options.appRoots ?? []);
    const fingerprint = fingerprintError(parsed);
    const hintResult = deriveHints(parsed);
    const hints = hintEngine(parsed);
    const snapshot = snapshotRequest(req, options, redact);

    const report: ErrorReport = {
      fingerprint,
      occurredAt: new Date().toISOString(),
      level: status >= 500 ? "error" : "warn",
      error: parsed,
      request: snapshot,
      hints,
      suggestedFix: hintResult.suggestedFix,
    };

    reporter.record(report);

    if (options.onError) {
      void options.onError(report);
    }

    if (options.pretty) {
      process.stderr.write(`${formatReport(report)}\n`);
    }

    if (res.locals) res.locals.stacksenseReport = report;

    if (responseMode === "passthrough") {
      return next(err);
    }

    if (responseMode === "minimal") {
      res.status(status).json({
        error: { name: parsed.name, message: parsed.message, fingerprint },
      });
      return;
    }

    res.status(status).json({
      success: false,
      error: {
        name: parsed.name,
        code: parsed.code,
        message: parsed.message,
        fingerprint,
        hints,
        suggestedFix: hintResult.suggestedFix,
      },
    });
  };

  return {
    reporter,
    middleware,
    inspect: (fp) => reporter.get(fp)?.sample,
    list: () => reporter.list(),
  };
}

function snapshotRequest(
  req: ReqLike,
  options: StacksenseOptions,
  redact: (input: unknown) => unknown,
): RequestSnapshot | undefined {
  if (!req) return undefined;
  const headers = options.exposeHeaders
    ? (redact(req.headers) as Record<string, string | string[] | undefined>)
    : undefined;
  const body =
    options.includeRequestBody && req.body !== undefined ? redact(req.body) : undefined;
  const bodySize = req.body !== undefined ? approxSize(req.body) : undefined;
  const userAgentHeader = req.headers["user-agent"];
  const userAgent = typeof userAgentHeader === "string" ? userAgentHeader : undefined;
  return {
    method: req.method ?? "GET",
    path: req.originalUrl ?? req.url ?? req.path ?? "/",
    query: req.query ? (redact(req.query) as Record<string, unknown>) : undefined,
    params: req.params ? (redact(req.params) as Record<string, unknown>) : undefined,
    bodySize,
    body,
    headers,
    ip: req.ip,
    userAgent,
  };
}

function approxSize(v: unknown): number {
  try {
    if (typeof v === "string") return Buffer.byteLength(v);
    return Buffer.byteLength(JSON.stringify(v));
  } catch {
    return 0;
  }
}

function guessStatus(err: unknown): number {
  if (err && typeof err === "object") {
    const obj = err as { status?: unknown; statusCode?: unknown };
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.statusCode === "number") return obj.statusCode;
  }
  return 500;
}
