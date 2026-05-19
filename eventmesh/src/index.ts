import { EventEmitter } from "node:events";

export class EventMesh extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  publish<T>(topic: string, payload: T): boolean {
    return this.emit(topic, payload);
  }

  subscribe<T>(topic: string, handler: (payload: T) => void): () => void {
    const wrapped = (payload: unknown) => handler(payload as T);
    this.on(topic, wrapped);
    return () => this.off(topic, wrapped);
  }

  onceEvent<T>(topic: string, handler: (payload: T) => void): void {
    this.once(topic, (payload: unknown) => handler(payload as T));
  }
}

/** Factory for tests / DI */
export function eventmesh(): EventMesh {
  return new EventMesh();
}
