import type {
  ErrorEnvelope,
  PaginatedEnvelope,
  PaginationInput,
  SuccessEnvelope,
} from "./types.js";

interface BuildMeta {
  traceId: string;
  startedAt: number;
  extra?: Record<string, unknown>;
}

export function buildSuccess<T>(data: T, meta: BuildMeta): SuccessEnvelope<T> {
  const now = Date.now();
  return {
    success: true,
    data,
    meta: {
      traceId: meta.traceId,
      timestamp: new Date(now).toISOString(),
      durationMs: Math.max(0, now - meta.startedAt),
      ...(meta.extra ?? {}),
    },
  };
}

export function buildPaginated<T>(
  items: T[],
  pagination: PaginationInput,
  meta: BuildMeta,
): PaginatedEnvelope<T> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.max(1, pagination.pageSize ?? (items.length || 10));
  const total = Math.max(0, pagination.total);
  const totalPages = pageSize === 0 ? 0 : Math.ceil(total / pageSize);
  const base = buildSuccess(items, meta);
  return {
    ...base,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export function buildError(
  message: string,
  meta: BuildMeta & { status: number; code: string; details?: unknown },
): ErrorEnvelope {
  const now = Date.now();
  return {
    success: false,
    error: {
      code: meta.code,
      message,
      status: meta.status,
      details: meta.details,
    },
    meta: {
      traceId: meta.traceId,
      timestamp: new Date(now).toISOString(),
      durationMs: Math.max(0, now - meta.startedAt),
    },
  };
}
