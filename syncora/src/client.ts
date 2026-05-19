import { applyEventToDocuments } from "./apply.js";
import type {
  ChangeEvent,
  ClientMessage,
  Filter,
  ServerMessage,
  SyncDocument,
} from "./types.js";

type WSLike = {
  send(data: string): void;
  close(): void;
  addEventListener(event: "open", cb: () => void): void;
  addEventListener(event: "close", cb: () => void): void;
  addEventListener(event: "error", cb: (event: unknown) => void): void;
  addEventListener(event: "message", cb: (event: { data: unknown }) => void): void;
  readyState?: number;
};

type WSConstructor = new (url: string) => WSLike;

export interface SyncoraClientOptions {
  url: string;
  WebSocket?: WSConstructor;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

export interface Subscription<T extends SyncDocument = SyncDocument> {
  id: string;
  collection: string;
  filter?: Filter;
  data: T[];
  version: number;
  unsubscribe(): void;
  onChange(listener: (state: { data: T[]; version: number }) => void): () => void;
}

type Listener<T extends SyncDocument> = (state: { data: T[]; version: number }) => void;

/** Stored subscriptions are document-shaped only; `subscribe<T>` bridges at the API boundary. */
interface InternalSubscription {
  id: string;
  collection: string;
  filter?: Filter;
  data: SyncDocument[];
  version: number;
  listeners: Set<(state: { data: SyncDocument[]; version: number }) => void>;
}

type PendingMutation = { resolve: () => void; reject: (err: Error) => void };

export class SyncoraClient {
  private url: string;
  private WS: WSConstructor;
  private socket?: WSLike;
  private subscriptions = new Map<string, InternalSubscription>();
  private pendingMutations = new Map<string, PendingMutation>();
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private currentDelay: number;
  private intentionalClose = false;
  private clientId?: string;
  private outbox: ClientMessage[] = [];
  private connectedListeners = new Set<(clientId: string) => void>();
  private disconnectedListeners = new Set<() => void>();
  private onError?: (error: unknown) => void;

  constructor(options: SyncoraClientOptions) {
    this.url = options.url;
    this.WS = options.WebSocket ?? (globalThis as { WebSocket?: WSConstructor }).WebSocket as WSConstructor;
    if (!this.WS) throw new Error("No WebSocket implementation. Pass options.WebSocket explicitly.");
    this.reconnectDelay = options.reconnectDelayMs ?? 500;
    this.maxReconnectDelay = options.maxReconnectDelayMs ?? 15_000;
    this.currentDelay = this.reconnectDelay;
    this.onError = options.onError;
    if (options.onConnect) this.connectedListeners.add(options.onConnect);
    if (options.onDisconnect) this.disconnectedListeners.add(options.onDisconnect);
    this.connect();
  }

  isConnected(): boolean {
    return this.socket?.readyState === 1;
  }

  close(): void {
    this.intentionalClose = true;
    this.socket?.close();
  }

  onConnect(handler: (clientId: string) => void): () => void {
    this.connectedListeners.add(handler);
    return () => this.connectedListeners.delete(handler);
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectedListeners.add(handler);
    return () => this.disconnectedListeners.delete(handler);
  }

  subscribe<T extends SyncDocument = SyncDocument>(collection: string, options: { filter?: Filter } = {}): Subscription<T> {
    const id = `sub_${cryptoRandom()}`;
    const sub: InternalSubscription = {
      id,
      collection,
      filter: options.filter,
      data: [],
      version: 0,
      listeners: new Set(),
    };
    this.subscriptions.set(id, sub);
    this.send({ type: "subscribe", subscriptionId: id, collection, filter: options.filter });
    const api: Subscription<T> = {
      id,
      collection,
      filter: options.filter,
      get data() { return sub.data as T[]; },
      get version() { return sub.version; },
      unsubscribe: () => {
        this.subscriptions.delete(id);
        this.send({ type: "unsubscribe", subscriptionId: id });
      },
      onChange: (listener: Listener<T>) => {
        const bridge = (state: { data: SyncDocument[]; version: number }) => {
          listener({ data: state.data as T[], version: state.version });
        };
        sub.listeners.add(bridge);
        bridge({ data: sub.data, version: sub.version });
        return () => sub.listeners.delete(bridge);
      },
    };
    return api;
  }

  async mutate(
    collection: string,
    op: "insert" | "update" | "delete",
    payload: { document?: SyncDocument; documentId?: string; patch?: Partial<SyncDocument> } = {},
  ): Promise<void> {
    const mutationId = `mut_${cryptoRandom()}`;
    const message: ClientMessage = {
      type: "mutation",
      mutationId,
      collection,
      op,
      ...payload,
    };
    return new Promise<void>((resolve, reject) => {
      this.pendingMutations.set(mutationId, { resolve, reject });
      this.send(message);
    });
  }

  private connect(): void {
    this.intentionalClose = false;
    let socket: WSLike;
    try {
      socket = new this.WS(this.url);
    } catch (err) {
      this.onError?.(err);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.currentDelay = this.reconnectDelay;
      for (const msg of this.outbox) {
        try { socket.send(JSON.stringify(msg)); } catch { /* drop */ }
      }
      this.outbox = [];
      for (const sub of this.subscriptions.values()) {
        try {
          socket.send(JSON.stringify({ type: "subscribe", subscriptionId: sub.id, collection: sub.collection, filter: sub.filter } satisfies ClientMessage));
        } catch { /* drop */ }
      }
    });
    socket.addEventListener("message", (event) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(typeof event.data === "string" ? event.data : String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      this.handleMessage(parsed);
    });
    socket.addEventListener("error", (err) => this.onError?.(err));
    socket.addEventListener("close", () => {
      for (const listener of this.disconnectedListeners) listener();
      if (!this.intentionalClose) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    const delay = this.currentDelay;
    this.currentDelay = Math.min(this.maxReconnectDelay, this.currentDelay * 2);
    setTimeout(() => this.connect(), delay);
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case "hello":
        this.clientId = message.clientId;
        for (const listener of this.connectedListeners) listener(message.clientId);
        break;
      case "event": {
        const sub = this.subscriptions.get(message.subscriptionId);
        if (!sub) return;
        applyEventToSubscription(sub, message.event);
        for (const l of sub.listeners) l({ data: sub.data, version: sub.version });
        break;
      }
      case "ack": {
        const pending = this.pendingMutations.get(message.mutationId);
        if (!pending) return;
        this.pendingMutations.delete(message.mutationId);
        if (message.ok) pending.resolve();
        else pending.reject(new Error(message.error ?? "mutation rejected"));
        break;
      }
      case "error":
        this.onError?.(new Error(message.message));
        break;
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === 1) {
      try {
        this.socket.send(JSON.stringify(message));
        return;
      } catch { /* fall through to outbox */ }
    }
    this.outbox.push(message);
  }
}

function applyEventToSubscription(sub: InternalSubscription, event: ChangeEvent): void {
  const { data, version } = applyEventToDocuments<SyncDocument>(sub.data, sub.version, event, sub.filter);
  sub.data = data;
  sub.version = version;
}

function cryptoRandom(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
