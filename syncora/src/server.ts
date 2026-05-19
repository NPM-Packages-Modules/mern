import { randomBytes } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import { matches } from "./filter.js";
import { MemoryStore, type SyncStore } from "./store.js";
import type {
  ChangeEvent,
  ClientMessage,
  Filter,
  ServerMessage,
  SyncDocument,
} from "./types.js";

export interface SyncServerOptions {
  store?: SyncStore;
  server?: HttpServer;
  port?: number;
  host?: string;
  path?: string;
  authorize?: (handshake: { headers: Record<string, string | string[] | undefined>; url?: string }) => boolean | Promise<boolean>;
  permit?: (clientId: string, message: ClientMessage) => boolean | Promise<boolean>;
}

interface ClientSession {
  id: string;
  socket: WebSocket;
  subscriptions: Map<string, { collection: string; filter?: Filter }>;
}

export class SyncServer {
  readonly store: SyncStore;
  private wss: WebSocketServer;
  private clients = new Map<string, ClientSession>();
  private unwatch: () => void;
  private serverVersion = 0;

  constructor(options: SyncServerOptions = {}) {
    this.store = options.store ?? new MemoryStore();
    const wssConfig: ConstructorParameters<typeof WebSocketServer>[0] = options.server
      ? { server: options.server, path: options.path }
      : { host: options.host ?? "127.0.0.1", port: options.port ?? 0, path: options.path };
    this.wss = new WebSocketServer(wssConfig);
    this.wss.on("connection", (socket, req) => this.handleConnection(socket, req, options.authorize, options.permit));
    this.unwatch = this.store.watch((event) => this.fanoutEvent(event));
  }

  address(): { host: string; port: number } | null {
    const a = this.wss.address();
    if (typeof a === "string" || a === null) return null;
    return { host: a.address, port: a.port };
  }

  async close(): Promise<void> {
    this.unwatch();
    for (const session of this.clients.values()) {
      try { session.socket.close(); } catch { /* ignore */ }
    }
    this.clients.clear();
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }

  attachChangeStream(emitter: { on: (event: "change", handler: (event: ChangeEvent) => void) => unknown }): () => void {
    const handler = (event: ChangeEvent) => this.fanoutEvent(event);
    emitter.on("change", handler);
    return () => {
      const off = (emitter as unknown as { off?: (event: string, handler: unknown) => unknown }).off;
      if (typeof off === "function") off.call(emitter, "change", handler);
    };
  }

  private async handleConnection(
    socket: WebSocket,
    req: { headers: Record<string, string | string[] | undefined>; url?: string },
    authorize?: SyncServerOptions["authorize"],
    permit?: SyncServerOptions["permit"],
  ): Promise<void> {
    if (authorize) {
      try {
        const ok = await authorize({ headers: req.headers, url: req.url });
        if (!ok) {
          socket.close(4401, "unauthorized");
          return;
        }
      } catch {
        socket.close(4401, "unauthorized");
        return;
      }
    }
    const session: ClientSession = {
      id: `c_${randomBytes(8).toString("hex")}`,
      socket,
      subscriptions: new Map(),
    };
    this.clients.set(session.id, session);

    socket.on("close", () => this.clients.delete(session.id));
    socket.on("error", () => { /* socket lifecycle handled by ws */ });
    socket.on("message", (data) => {
      this.handleMessage(session, data.toString(), permit).catch(() => {
        send(socket, { type: "error", message: "internal error" });
      });
    });

    send(socket, { type: "hello", clientId: session.id, serverVersion: this.serverVersion });
  }

  private async handleMessage(
    session: ClientSession,
    raw: string,
    permit?: SyncServerOptions["permit"],
  ): Promise<void> {
    let message: ClientMessage;
    try { message = JSON.parse(raw) as ClientMessage; } catch {
      send(session.socket, { type: "error", message: "invalid JSON" });
      return;
    }
    if (permit) {
      try {
        const allowed = await permit(session.id, message);
        if (!allowed) {
          send(session.socket, { type: "error", message: "forbidden" });
          return;
        }
      } catch {
        send(session.socket, { type: "error", message: "permission check failed" });
        return;
      }
    }
    switch (message.type) {
      case "subscribe":
        return this.handleSubscribe(session, message);
      case "unsubscribe":
        session.subscriptions.delete(message.subscriptionId);
        return;
      case "mutation":
        return this.handleMutation(session, message);
      default:
        send(session.socket, { type: "error", message: "unknown message type" });
    }
  }

  private handleSubscribe(session: ClientSession, message: Extract<ClientMessage, { type: "subscribe" }>): void {
    session.subscriptions.set(message.subscriptionId, { collection: message.collection, filter: message.filter });
    const snapshot = this.store.snapshot(message.collection, message.filter);
    send(session.socket, {
      type: "event",
      subscriptionId: message.subscriptionId,
      event: { type: "snapshot", collection: message.collection, documents: snapshot.documents, version: snapshot.version },
    });
  }

  private handleMutation(session: ClientSession, message: Extract<ClientMessage, { type: "mutation" }>): void {
    try {
      if (message.op === "insert") {
        if (!message.document) throw new Error("document required");
        this.store.insert(message.collection, message.document);
      } else if (message.op === "update") {
        if (!message.documentId || !message.patch) throw new Error("documentId and patch required");
        const result = this.store.update(message.collection, message.documentId, message.patch);
        if (!result) throw new Error("not found");
      } else if (message.op === "delete") {
        if (!message.documentId) throw new Error("documentId required");
        const ok = this.store.delete(message.collection, message.documentId);
        if (!ok) throw new Error("not found");
      }
      send(session.socket, { type: "ack", mutationId: message.mutationId, ok: true });
    } catch (err) {
      send(session.socket, {
        type: "ack",
        mutationId: message.mutationId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private fanoutEvent(event: ChangeEvent): void {
    this.serverVersion = Math.max(this.serverVersion, event.version);
    for (const session of this.clients.values()) {
      for (const [subscriptionId, sub] of session.subscriptions) {
        if (sub.collection !== event.collection) continue;
        if (!eventMatchesFilter(event, sub.filter)) continue;
        send(session.socket, { type: "event", subscriptionId, event });
      }
    }
  }
}

function eventMatchesFilter(event: ChangeEvent, filter: Filter | undefined): boolean {
  if (!filter) return true;
  if (event.type === "snapshot") return true;
  if (event.type === "delete") return true;
  if (event.type === "insert") return matches(event.document, filter);
  if (event.type === "update") return matches(event.patch as SyncDocument, filter);
  return true;
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== 1) return;
  try {
    socket.send(JSON.stringify(message));
  } catch {
    /* socket may have closed mid-send */
  }
}
