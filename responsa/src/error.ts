export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  expose: boolean;

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: unknown; expose?: boolean } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 500;
    this.code = options.code ?? defaultCodeForStatus(this.status);
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(message, { status: 400, code: "BAD_REQUEST", details, expose: true });
}

export function unauthorized(message = "Unauthorized"): ApiError {
  return new ApiError(message, { status: 401, code: "UNAUTHORIZED", expose: true });
}

export function forbidden(message = "Forbidden"): ApiError {
  return new ApiError(message, { status: 403, code: "FORBIDDEN", expose: true });
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError(message, { status: 404, code: "NOT_FOUND", expose: true });
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(message, { status: 409, code: "CONFLICT", details, expose: true });
}

export function unprocessable(message: string, details?: unknown): ApiError {
  return new ApiError(message, {
    status: 422,
    code: "UNPROCESSABLE_ENTITY",
    details,
    expose: true,
  });
}

export function tooManyRequests(message = "Too many requests"): ApiError {
  return new ApiError(message, { status: 429, code: "RATE_LIMITED", expose: true });
}

export function internal(message = "Internal server error"): ApiError {
  return new ApiError(message, { status: 500, code: "INTERNAL_ERROR", expose: false });
}

export function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 422: return "UNPROCESSABLE_ENTITY";
    case 429: return "RATE_LIMITED";
    case 500: return "INTERNAL_ERROR";
    case 502: return "BAD_GATEWAY";
    case 503: return "SERVICE_UNAVAILABLE";
    case 504: return "GATEWAY_TIMEOUT";
    default: return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
  }
}
