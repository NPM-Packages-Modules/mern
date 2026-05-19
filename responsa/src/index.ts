export { responsa, errorHandler } from "./middleware.js";
export { buildSuccess, buildPaginated, buildError } from "./envelope.js";
export {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
  internal,
  defaultCodeForStatus,
} from "./error.js";
export { generateTraceId, pickTraceId } from "./trace.js";
export type {
  SuccessEnvelope,
  ErrorEnvelope,
  PaginatedEnvelope,
  PaginationInput,
  ResponsaOptions,
  ResponsaResponse,
} from "./types.js";

declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, meta?: Record<string, unknown>): Response;
      created<T>(data: T, meta?: Record<string, unknown>): Response;
      noContent(): Response;
      paginated<T>(
        items: T[],
        pagination: { page?: number; pageSize?: number; total: number },
        meta?: Record<string, unknown>,
      ): Response;
      error(
        message: string,
        options?: { status?: number; code?: string; details?: unknown },
      ): Response;
      fail(err: unknown): Response;
      traceId: string;
    }
  }
}
