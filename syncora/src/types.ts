export interface SyncDocument {
  _id: string;
  [key: string]: unknown;
}

export type ChangeEvent<T extends SyncDocument = SyncDocument> =
  | { type: "insert"; collection: string; document: T; version: number }
  | { type: "update"; collection: string; documentId: string; patch: Partial<T>; version: number }
  | { type: "delete"; collection: string; documentId: string; version: number }
  | { type: "snapshot"; collection: string; documents: T[]; version: number };

export type ClientMessage =
  | { type: "subscribe"; subscriptionId: string; collection: string; filter?: Record<string, unknown> }
  | { type: "unsubscribe"; subscriptionId: string }
  | { type: "mutation"; mutationId: string; collection: string; op: "insert" | "update" | "delete"; document?: SyncDocument; patch?: Partial<SyncDocument>; documentId?: string };

export type ServerMessage =
  | { type: "hello"; clientId: string; serverVersion: number }
  | { type: "event"; subscriptionId: string; event: ChangeEvent }
  | { type: "ack"; mutationId: string; ok: boolean; error?: string }
  | { type: "error"; message: string };

export interface Filter {
  [field: string]: unknown;
}

export interface StoreSnapshot<T extends SyncDocument = SyncDocument> {
  documents: T[];
  version: number;
}
