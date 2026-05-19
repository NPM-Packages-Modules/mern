import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { Span } from "./types.js";

interface TraceContext {
  traceId: string;
  spanId: string;
}

export class Tracer {
  private storage = new AsyncLocalStorage<TraceContext>();
  private spans: Span[] = [];
  private max: number;

  constructor(options: { maxSpans?: number } = {}) {
    this.max = options.maxSpans ?? 500;
  }

  start(name: string, kind: Span["kind"] = "custom", metadata: Record<string, unknown> = {}): {
    end: (info?: { error?: unknown; status?: Span["status"]; extra?: Record<string, unknown> }) => Span;
  } {
    const startedAt = Date.now();
    const id = `s_${randomBytes(6).toString("hex")}`;
    const parent = this.storage.getStore();
    const traceId = parent?.traceId ?? `t_${randomBytes(8).toString("hex")}`;
    const parentId = parent?.spanId;

    return {
      end: (info = {}) => {
        const status: Span["status"] = info.error ? "error" : info.status ?? "ok";
        const errorMsg = info.error instanceof Error ? info.error.message : info.error ? String(info.error) : undefined;
        const span: Span = {
          id,
          parentId,
          traceId,
          name,
          kind,
          startedAt,
          durationMs: Date.now() - startedAt,
          metadata: { ...metadata, ...(info.extra ?? {}) },
          status,
          error: errorMsg,
        };
        this.push(span);
        return span;
      },
    };
  }

  async withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    options: { kind?: Span["kind"]; metadata?: Record<string, unknown> } = {},
  ): Promise<T> {
    const startedAt = Date.now();
    const parent = this.storage.getStore();
    const traceId = parent?.traceId ?? `t_${randomBytes(8).toString("hex")}`;
    const spanId = `s_${randomBytes(6).toString("hex")}`;
    return this.storage.run({ traceId, spanId }, async () => {
      try {
        const result = await fn();
        this.push({
          id: spanId,
          parentId: parent?.spanId,
          traceId,
          name,
          kind: options.kind ?? "custom",
          startedAt,
          durationMs: Date.now() - startedAt,
          metadata: options.metadata ?? {},
          status: "ok",
        });
        return result;
      } catch (err) {
        this.push({
          id: spanId,
          parentId: parent?.spanId,
          traceId,
          name,
          kind: options.kind ?? "custom",
          startedAt,
          durationMs: Date.now() - startedAt,
          metadata: options.metadata ?? {},
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });
  }

  runInContext<T>(traceId: string, fn: () => T): T {
    const spanId = `s_${randomBytes(6).toString("hex")}`;
    return this.storage.run({ traceId, spanId }, fn);
  }

  currentTraceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }

  recent(limit = 100): Span[] {
    return this.spans.slice(-limit);
  }

  byTrace(traceId: string): Span[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  reset(): void {
    this.spans = [];
  }

  private push(span: Span): void {
    this.spans.push(span);
    if (this.spans.length > this.max) this.spans.shift();
  }
}
