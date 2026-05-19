export type FusionSource<T = unknown> = () => Promise<T>;

export interface FusionEntry<T = unknown> {
  ok: boolean;
  value?: T;
  reason?: unknown;
}

export async function fusionstackCombine<T = unknown>(sources: FusionSource<T>[]): Promise<FusionEntry<T>[]> {
  const settled = await Promise.allSettled(sources.map((s) => s()));
  return settled.map((r) =>
    r.status === "fulfilled"
      ? { ok: true, value: r.value as T }
      : { ok: false, reason: r.reason }
  );
}

export async function fusionstackMergeObjects(parts: Record<string, unknown>[]): Promise<Record<string, unknown>> {
  return Object.assign({}, ...parts);
}
