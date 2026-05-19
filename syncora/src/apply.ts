import { matches } from "./filter.js";
import type { ChangeEvent, Filter, SyncDocument } from "./types.js";

export function applyEventToDocuments<T extends SyncDocument>(
  documents: T[],
  version: number,
  event: ChangeEvent,
  filter?: Filter,
): { data: T[]; version: number } {
  if (event.type === "snapshot") {
    const next = (event.documents as T[]).filter((d) => matches(d, filter));
    return { data: next, version: event.version };
  }
  if (event.type === "insert") {
    if (!matches(event.document, filter)) return { data: documents, version: event.version };
    const next = [...documents.filter((d) => d._id !== event.document._id), event.document as T];
    return { data: next, version: event.version };
  }
  if (event.type === "update") {
    const next = documents.map((d) =>
      d._id === event.documentId ? ({ ...d, ...event.patch, _id: d._id } as T) : d,
    );
    if (filter) {
      const filtered = next.filter((d) => matches(d, filter));
      return { data: filtered, version: event.version };
    }
    return { data: next, version: event.version };
  }
  if (event.type === "delete") {
    return { data: documents.filter((d) => d._id !== event.documentId), version: event.version };
  }
  return { data: documents, version };
}

export function applyOptimisticInsert<T extends SyncDocument>(documents: T[], document: T): T[] {
  return [...documents.filter((d) => d._id !== document._id), document];
}

export function applyOptimisticUpdate<T extends SyncDocument>(
  documents: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return documents.map((d) => (d._id === id ? ({ ...d, ...patch, _id: id } as T) : d));
}

export function applyOptimisticDelete<T extends SyncDocument>(documents: T[], id: string): T[] {
  return documents.filter((d) => d._id !== id);
}
