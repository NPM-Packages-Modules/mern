export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: {
    traceId: string;
    timestamp: string;
    durationMs: number;
    [key: string]: unknown;
  };
}

export interface PaginatedEnvelope<T> extends SuccessEnvelope<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
  meta: {
    traceId: string;
    timestamp: string;
    durationMs: number;
  };
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  total: number;
}

export interface ResponsaOptions {
  traceIdHeader?: string;
  exposeTraceIdHeader?: boolean;
  generateTraceId?: () => string;
  defaultErrorCode?: string;
  defaultErrorStatus?: number;
  includeStack?: boolean;
  errorMapper?: (err: unknown) => Partial<ErrorEnvelope["error"]> | undefined;
}

export type ResponsaResponse = {
  success<T>(data: T, meta?: Record<string, unknown>): unknown;
  created<T>(data: T, meta?: Record<string, unknown>): unknown;
  noContent(): unknown;
  paginated<T>(items: T[], pagination: PaginationInput, meta?: Record<string, unknown>): unknown;
  error(
    message: string,
    options?: { status?: number; code?: string; details?: unknown },
  ): unknown;
  fail(err: unknown): unknown;
  traceId: string;
};
