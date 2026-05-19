import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  applyOptimisticDelete,
  applyOptimisticInsert,
  applyOptimisticUpdate,
} from "./apply.js";
import type { SyncoraClient, Subscription } from "./client.js";
import type { Filter, SyncDocument } from "./types.js";

export interface UseSyncoraResult<T extends SyncDocument> {
  data: T[];
  version: number;
  isConnected: boolean;
  insert(document: T): Promise<void>;
  update(id: string, patch: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface UseSyncoraOptions {
  filter?: Filter;
  optimistic?: boolean;
}

export function createSyncoraHooks(client: SyncoraClient) {
  function useSyncora<T extends SyncDocument = SyncDocument>(
    collection: string,
    options: UseSyncoraOptions = {},
  ): UseSyncoraResult<T> {
    const subscriptionRef = useRef<Subscription<T> | null>(null);
    const [, force] = useState(0);

    useEffect(() => {
      const sub = client.subscribe<T>(collection, { filter: options.filter });
      subscriptionRef.current = sub;
      const off = sub.onChange(() => force((n) => n + 1));
      return () => {
        off();
        sub.unsubscribe();
        subscriptionRef.current = null;
      };
    }, [collection, JSON.stringify(options.filter)]);

    const isConnected = useSyncExternalStore(
      (notify) => {
        const onC = client.onConnect(() => notify());
        const onD = client.onDisconnect(() => notify());
        return () => { onC(); onD(); };
      },
      () => client.isConnected(),
      () => false,
    );

    const data = subscriptionRef.current?.data ?? [];
    const version = subscriptionRef.current?.version ?? 0;

    const actions = useMemo(() => {
      const insert = async (document: T) => {
        if (options.optimistic && subscriptionRef.current) {
          subscriptionRef.current.data = applyOptimisticInsert(subscriptionRef.current.data, document);
          force((n) => n + 1);
        }
        await client.mutate(collection, "insert", { document });
      };
      const update = async (id: string, patch: Partial<T>) => {
        if (options.optimistic && subscriptionRef.current) {
          subscriptionRef.current.data = applyOptimisticUpdate(subscriptionRef.current.data, id, patch);
          force((n) => n + 1);
        }
        await client.mutate(collection, "update", { documentId: id, patch: patch as Partial<SyncDocument> });
      };
      const remove = async (id: string) => {
        if (options.optimistic && subscriptionRef.current) {
          subscriptionRef.current.data = applyOptimisticDelete(subscriptionRef.current.data, id);
          force((n) => n + 1);
        }
        await client.mutate(collection, "delete", { documentId: id });
      };
      return { insert, update, remove };
    }, [collection, options.optimistic]);

    return {
      data,
      version,
      isConnected,
      ...actions,
    };
  }

  return { useSyncora };
}
