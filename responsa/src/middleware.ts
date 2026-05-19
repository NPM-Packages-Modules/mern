import { buildError, buildPaginated, buildSuccess } from "./envelope.js";
import { ApiError, defaultCodeForStatus } from "./error.js";
import { generateTraceId, pickTraceId } from "./trace.js";
import type { PaginationInput, ResponsaOptions, ResponsaResponse } from "./types.js";

type ExpressLikeRequest = {
  headers: Record<string, string | string[] | undefined>;
};
type ExpressLikeResponse = {
  status(code: number): ExpressLikeResponse;
  json(payload: unknown): ExpressLikeResponse;
  setHeader(name: string, value: string): void;
  end(): void;
  locals?: Record<string, unknown>;
  headersSent?: boolean;
} & Partial<ResponsaResponse>;

type ExpressMiddleware = (
  req: ExpressLikeRequest,
  res: ExpressLikeResponse,
  next: (err?: unknown) => void,
) => void;
type ExpressErrorMiddleware = (
  err: unknown,
  req: ExpressLikeRequest,
  res: ExpressLikeResponse,
  next: (err?: unknown) => void,
) => void;

export function responsa(options: ResponsaOptions = {}): ExpressMiddleware {
  const {
    traceIdHeader = "x-trace-id",
    exposeTraceIdHeader = true,
    generateTraceId: gen = generateTraceId,
  } = options;

  return function responsaMiddleware(req, res, next) {
    const startedAt = Date.now();
    const traceId = pickTraceId(req.headers, traceIdHeader, gen);

    if (exposeTraceIdHeader) {
      res.setHeader(traceIdHeader, traceId);
    }

    const augmented = res as ExpressLikeResponse & ResponsaResponse;
    augmented.traceId = traceId;

    augmented.success = function success<T>(data: T, extra?: Record<string, unknown>) {
      const body = buildSuccess(data, { traceId, startedAt, extra });
      return res.status(200).json(body);
    };
    augmented.created = function created<T>(data: T, extra?: Record<string, unknown>) {
      const body = buildSuccess(data, { traceId, startedAt, extra });
      return res.status(201).json(body);
    };
    augmented.noContent = function noContent() {
      res.status(204).end();
      return res;
    };
    augmented.paginated = function paginated<T>(
      items: T[],
      pagination: PaginationInput,
      extra?: Record<string, unknown>,
    ) {
      const body = buildPaginated(items, pagination, { traceId, startedAt, extra });
      return res.status(200).json(body);
    };
    augmented.error = function errorFn(
      message: string,
      opts: { status?: number; code?: string; details?: unknown } = {},
    ) {
      const status = opts.status ?? options.defaultErrorStatus ?? 500;
      const code = opts.code ?? options.defaultErrorCode ?? defaultCodeForStatus(status);
      const body = buildError(message, {
        traceId,
        startedAt,
        status,
        code,
        details: opts.details,
      });
      return res.status(status).json(body);
    };
    augmented.fail = function fail(err: unknown) {
      const { status, code, message, details } = normalizeError(err, options);
      const body = buildError(message, { traceId, startedAt, status, code, details });
      return res.status(status).json(body);
    };

    if (res.locals) {
      res.locals.traceId = traceId;
    }

    next();
  };
}

export function errorHandler(options: ResponsaOptions = {}): ExpressErrorMiddleware {
  const traceIdHeader = options.traceIdHeader ?? "x-trace-id";
  const gen = options.generateTraceId ?? generateTraceId;

  return function responsaErrorHandler(err, req, res, next) {
    if (res.headersSent) {
      next(err);
      return;
    }
    const startedAt = Date.now();
    const traceId =
      (res as ExpressLikeResponse & { traceId?: string }).traceId ??
      pickTraceId(req.headers, traceIdHeader, gen);

    const normalized = normalizeError(err, options);
    const body = buildError(normalized.message, {
      traceId,
      startedAt,
      status: normalized.status,
      code: normalized.code,
      details: normalized.details,
    });
    if (options.includeStack && err instanceof Error && err.stack) {
      (body.error as Record<string, unknown>).stack = err.stack.split("\n");
    }
    res.status(normalized.status).json(body);
  };
}

function normalizeError(
  err: unknown,
  options: ResponsaOptions,
): { status: number; code: string; message: string; details?: unknown } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      code: err.code,
      message: err.expose ? err.message : "Internal server error",
      details: err.expose ? err.details : undefined,
    };
  }
  if (options.errorMapper) {
    const mapped = options.errorMapper(err);
    if (mapped) {
      return {
        status: mapped.status ?? options.defaultErrorStatus ?? 500,
        code: mapped.code ?? options.defaultErrorCode ?? "INTERNAL_ERROR",
        message: mapped.message ?? "Internal server error",
        details: mapped.details,
      };
    }
  }
  if (err instanceof Error) {
    return {
      status: options.defaultErrorStatus ?? 500,
      code: options.defaultErrorCode ?? "INTERNAL_ERROR",
      message: err.message || "Internal server error",
    };
  }
  return {
    status: options.defaultErrorStatus ?? 500,
    code: options.defaultErrorCode ?? "INTERNAL_ERROR",
    message: "Internal server error",
  };
}
