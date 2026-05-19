export type ConnectionState = "connecting" | "connected" | "reconnecting" | "closed";

export interface BackoffConfig {
  /** Initial delay in milliseconds. Default: 1000. */
  initial?: number;
  /** Maximum cap in milliseconds. Default: 30_000. */
  max?: number;
  /** Geometric multiplier. Default: 2. */
  multiplier?: number;
  /** Jitter fraction in [0, 1]. Default: 1 (full jitter). */
  jitter?: number;
  /** Time of continuous connection after which the attempt counter resets. Default: 60_000. */
  resetAfterMs?: number;
  /** Max reconnect attempts before giving up. Default: Infinity. */
  maxAttempts?: number;
}

export interface HeartbeatConfig {
  /** How often to expect a heartbeat. Default: 30_000. */
  interval?: number;
  /** Disconnect if no heartbeat arrives within this many ms. Default: 60_000. */
  timeout?: number;
  /** SSE event name to listen for. Default: any event resets the timer. */
  event?: string;
}

export interface QueueConfig {
  /** Max queued items. Default: 100. */
  maxSize?: number;
  /** What to do when the queue overflows. Default: "drop-oldest". */
  onOverflow?: "drop-oldest" | "drop-newest" | "throw";
  /** Whether to auto-flush the queue when reconnected (WS only). Default: true. */
  flushOnReconnect?: boolean;
}

export interface SSEEvent {
  event: string | null;
  data: string;
  id: string | null;
  retry: number | null;
}

export interface ReconnectEvent {
  attempt: number;
  delay: number;
  reason?: string;
}

export interface StateChangeEvent {
  from: ConnectionState;
  to: ConnectionState;
}
