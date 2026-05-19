import { DEFAULT_BACKOFF, nextDelay, shouldReset } from "./backoff.js";
import { TypedEmitter } from "./event-emitter.js";
import { BoundedQueue } from "./queue.js";
import type {
  BackoffConfig,
  ConnectionState,
  QueueConfig,
  ReconnectEvent,
  StateChangeEvent,
} from "./types.js";

export interface ReconnectingWebSocketOptions {
  backoff?: BackoffConfig;
  queue?: QueueConfig;
  pingInterval?: number;
  pongTimeout?: number;
  protocols?: string | string[];
  /** Optional WebSocket constructor override (e.g. node `ws`). */
  WebSocketCtor?: typeof WebSocket;
}

type MessageData = string | ArrayBufferLike | Blob | ArrayBufferView;

interface WSEvents {
  open: void;
  message: { data: unknown };
  reconnect: ReconnectEvent;
  state: StateChangeEvent;
  error: { error: Error };
  close: { code: number; reason: string };
}

export class ReconnectingWebSocket extends TypedEmitter<WSEvents> {
  readonly url: string;
  private readonly opts: ReconnectingWebSocketOptions;
  private socket?: WebSocket;
  private state: ConnectionState = "closed";
  private queue: BoundedQueue<MessageData>;
  private attempt = 0;
  private explicitlyClosed = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setTimeout>;
  private pongTimer?: ReturnType<typeof setTimeout>;
  private connectTime: number | null = null;

  constructor(url: string, opts: ReconnectingWebSocketOptions = {}) {
    super();
    this.url = url;
    this.opts = opts;
    this.queue = new BoundedQueue<MessageData>(opts.queue ?? {});
    this.connect();
  }

  getState(): ConnectionState {
    return this.state;
  }

  send(data: MessageData): void {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(data as never);
    } else {
      this.queue.push(data);
    }
  }

  close(code = 1000, reason = "client closed"): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearTimeout(this.pingTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    if (this.socket) {
      try { this.socket.close(code, reason); } catch { /* ignore */ }
    }
    this.transition("closed");
  }

  private transition(to: ConnectionState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    this.emit("state", { from, to });
  }

  private connect(): void {
    if (this.explicitlyClosed) return;
    this.transition(this.attempt === 0 ? "connecting" : "reconnecting");
    const Ctor = this.opts.WebSocketCtor ?? (globalThis.WebSocket as typeof WebSocket | undefined);
    if (!Ctor) {
      const err = new Error("No WebSocket implementation available; install `ws` or pass WebSocketCtor.");
      this.emit("error", { error: err });
      return;
    }
    const protocols = this.opts.protocols;
    const sock = protocols ? new Ctor(this.url, protocols as never) : new Ctor(this.url);
    this.socket = sock as WebSocket;

    sock.addEventListener("open", () => {
      this.connectTime = Date.now();
      this.transition("connected");
      this.emit("open", undefined);
      if (this.opts.queue?.flushOnReconnect !== false) {
        for (const item of this.queue.drain()) {
          try { sock.send(item as never); } catch (err) { this.emit("error", { error: err as Error }); }
        }
      }
      this.startPing();
    });

    sock.addEventListener("message", (e: MessageEvent) => {
      this.resetPong();
      this.emit("message", { data: e.data });
    });

    sock.addEventListener("error", (e: unknown) => {
      const err = (e as { message?: string })?.message ? new Error(String((e as { message: string }).message)) : new Error("WebSocket error");
      this.emit("error", { error: err });
    });

    sock.addEventListener("close", (e: CloseEvent) => {
      if (this.pingTimer) clearTimeout(this.pingTimer);
      if (this.pongTimer) clearTimeout(this.pongTimer);
      this.emit("close", { code: e.code, reason: e.reason });
      if (this.explicitlyClosed) {
        this.transition("closed");
        return;
      }
      if (this.connectTime && shouldReset(this.opts.backoff ?? {}, Date.now() - this.connectTime)) {
        this.attempt = 0;
      }
      this.scheduleReconnect(e.reason || `closed (${e.code})`);
    });
  }

  private startPing(): void {
    if (!this.opts.pingInterval) return;
    if (this.pingTimer) clearTimeout(this.pingTimer);
    this.pingTimer = setTimeout(() => {
      try {
        this.socket?.send("ping");
      } catch (err) {
        this.emit("error", { error: err as Error });
      }
      if (this.opts.pongTimeout) {
        this.pongTimer = setTimeout(() => {
          this.emit("error", { error: new Error("Pong timeout") });
          try { this.socket?.close(); } catch { /* ignore */ }
        }, this.opts.pongTimeout);
      }
      this.startPing();
    }, this.opts.pingInterval);
  }

  private resetPong(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer);
  }

  private scheduleReconnect(reason: string): void {
    if (this.explicitlyClosed) return;
    const cfg = { ...DEFAULT_BACKOFF, ...this.opts.backoff };
    if (this.attempt >= cfg.maxAttempts) {
      this.transition("closed");
      return;
    }
    const delay = nextDelay(cfg, this.attempt);
    this.attempt += 1;
    this.emit("reconnect", { attempt: this.attempt, delay, reason });
    this.transition("reconnecting");
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
