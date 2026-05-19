import type { SSEEvent } from "./types.js";

export interface SSEParserOptions {
  /** Initial last event ID to send on reconnect. */
  lastEventId?: string;
  /** Callback when the server emits a `retry:` field. */
  onRetry?(ms: number): void;
}

/**
 * Incremental SSE parser. Feed UTF-8 strings and pull events via `flush()` or the iterable.
 * Handles multi-line `data:`, comment lines (`:foo`), `id:`, `event:`, and `retry:`.
 */
export class SSEParser {
  private buffer = "";
  private events: SSEEvent[] = [];
  private currentEvent: string | null = null;
  private currentData: string[] = [];
  private currentId: string | null = null;
  private lastEventId: string | null = null;

  constructor(opts: SSEParserOptions = {}) {
    if (opts.lastEventId !== undefined) this.lastEventId = opts.lastEventId;
    this.onRetry = opts.onRetry;
  }

  private onRetry?: (ms: number) => void;

  feed(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.findLineBreak(this.buffer)) !== -1) {
      const line = this.buffer.slice(0, idx);
      const skip = this.buffer.charAt(idx) === "\r" && this.buffer.charAt(idx + 1) === "\n" ? 2 : 1;
      this.buffer = this.buffer.slice(idx + skip);
      this.processLine(line);
    }
    const events = this.events;
    this.events = [];
    return events;
  }

  private findLineBreak(s: string): number {
    let nIdx = s.indexOf("\n");
    let rIdx = s.indexOf("\r");
    if (nIdx === -1) return rIdx;
    if (rIdx === -1 || rIdx > nIdx) return nIdx;
    return rIdx;
  }

  private processLine(line: string): void {
    if (line === "") {
      this.dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "data":
        this.currentData.push(value);
        break;
      case "event":
        this.currentEvent = value;
        break;
      case "id":
        if (!value.includes("\0")) this.currentId = value;
        break;
      case "retry": {
        const n = Number(value);
        if (Number.isFinite(n) && this.onRetry) this.onRetry(n);
        break;
      }
    }
  }

  private dispatch(): void {
    if (this.currentData.length === 0 && this.currentEvent === null) return;
    if (this.currentId !== null) this.lastEventId = this.currentId;
    this.events.push({
      event: this.currentEvent,
      data: this.currentData.join("\n"),
      id: this.currentId ?? this.lastEventId,
      retry: null,
    });
    this.currentEvent = null;
    this.currentData = [];
    this.currentId = null;
  }

  getLastEventId(): string | null {
    return this.lastEventId;
  }
}
