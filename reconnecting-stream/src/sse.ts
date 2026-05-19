import { DEFAULT_BACKOFF, nextDelay, shouldReset } from "./backoff.js";
import { TypedEmitter } from "./event-emitter.js";
import { SSEParser } from "./sse-parser.js";
import type {
  BackoffConfig,
  ConnectionState,
  HeartbeatConfig,
  ReconnectEvent,
  SSEEvent,
  StateChangeEvent,
} from "./types.js";

export interface ReconnectingSSEOptions {
  backoff?: BackoffConfig;
  heartbeat?: HeartbeatConfig;
  headers?: Record<string, string>;
  /** Optional fetch impl; useful for tests. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

interface SSEEvents {
  open: void;
  message: SSEEvent;
  reconnect: ReconnectEvent;
  state: StateChangeEvent;
  error: { error: Error };
  close: void;
}

export class ReconnectingSSE extends TypedEmitter<SSEEvents> {
  readonly url: string;
  private readonly opts: ReconnectingSSEOptions;
  private parser: SSEParser;
  private state: ConnectionState = "closed";
  private attempt = 0;
  private controller?: AbortController;
  private connectTime: number | null = null;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private explicitlyClosed = false;
  private lastRetryMs?: number;

  constructor(url: string, opts: ReconnectingSSEOptions = {}) {
    super();
    this.url = url;
    this.opts = opts;
    this.parser = new SSEParser({
      onRetry: (ms) => { this.lastRetryMs = ms; },
    });
    this.connect();
  }

  getState(): ConnectionState {
    return this.state;
  }

  close(): void {
    this.explicitlyClosed = true;
    this.transition("closed");
    this.controller?.abort();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.emit("close", undefined);
  }

  private transition(to: ConnectionState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    this.emit("state", { from, to });
  }

  private resetHeartbeat(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    const hb = this.opts.heartbeat;
    if (!hb) return;
    const timeout = hb.timeout ?? 60_000;
    this.heartbeatTimer = setTimeout(() => {
      this.emit("error", { error: new Error("Heartbeat timeout") });
      this.scheduleReconnect("heartbeat-timeout");
    }, timeout);
  }

  private async connect(): Promise<void> {
    if (this.explicitlyClosed) return;
    this.transition(this.attempt === 0 ? "connecting" : "reconnecting");
    this.controller = new AbortController();
    const fetcher = this.opts.fetch ?? globalThis.fetch;
    try {
      const headers: Record<string, string> = {
        accept: "text/event-stream",
        ...(this.opts.headers ?? {}),
      };
      const lastId = this.parser.getLastEventId();
      if (lastId) headers["last-event-id"] = lastId;

      const res = await fetcher(this.url, {
        headers,
        signal: this.controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      this.transition("connected");
      this.connectTime = Date.now();
      this.emit("open", undefined);
      this.resetHeartbeat();

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = decoder.decode(value, { stream: true });
        const events = this.parser.feed(chunk);
        for (const ev of events) {
          const hb = this.opts.heartbeat;
          if (!hb?.event || ev.event === hb.event) this.resetHeartbeat();
          this.emit("message", ev);
        }
      }

      if (this.connectTime && shouldReset(this.opts.backoff ?? {}, Date.now() - this.connectTime)) {
        this.attempt = 0;
      }
      this.scheduleReconnect("eof");
    } catch (err) {
      if (this.explicitlyClosed) return;
      this.emit("error", { error: err instanceof Error ? err : new Error(String(err)) });
      this.scheduleReconnect((err as Error).message);
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.explicitlyClosed) return;
    const cfg = { ...DEFAULT_BACKOFF, ...this.opts.backoff };
    if (this.attempt >= cfg.maxAttempts) {
      this.transition("closed");
      this.emit("close", undefined);
      return;
    }
    let delay = nextDelay(cfg, this.attempt);
    if (this.lastRetryMs) delay = Math.max(delay, this.lastRetryMs);
    this.attempt += 1;
    this.emit("reconnect", { attempt: this.attempt, delay, reason });
    this.transition("reconnecting");
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
