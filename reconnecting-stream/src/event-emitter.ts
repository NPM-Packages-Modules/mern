type Listener<T> = (event: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEmitter<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const set = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return this;
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
    return this;
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) (listener as Listener<TEvents[K]>)(payload);
  }
}
