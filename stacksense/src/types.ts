export interface StackFrame {
  function: string;
  file: string;
  line?: number;
  column?: number;
  inApp: boolean;
  isNative: boolean;
  raw: string;
}

export interface ParsedError {
  name: string;
  message: string;
  code?: string;
  frames: StackFrame[];
  cause?: ParsedError;
}

export interface RequestSnapshot {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  bodySize?: number;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  userAgent?: string;
}

export interface ErrorReport {
  fingerprint: string;
  occurredAt: string;
  level: "error" | "warn";
  error: ParsedError;
  request?: RequestSnapshot;
  hints: string[];
  suggestedFix?: string;
}

export interface ErrorOccurrence {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sample: ErrorReport;
}

export interface StacksenseOptions {
  appRoots?: string[];
  includeRequestBody?: boolean;
  redactKeys?: string[];
  exposeHeaders?: boolean;
  pretty?: boolean;
  onError?: (report: ErrorReport) => void | Promise<void>;
  reporter?: ErrorReporter;
  hintEngine?: (err: ParsedError) => string[];
  responseMode?: "rich" | "minimal" | "passthrough";
  statusMapper?: (err: unknown) => number | undefined;
}

export interface ErrorReporter {
  record(report: ErrorReport): void;
  list(opts?: { minCount?: number }): ErrorOccurrence[];
  get(fingerprint: string): ErrorOccurrence | undefined;
  reset(): void;
  size(): number;
}
