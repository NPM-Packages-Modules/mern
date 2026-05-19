import type { QueueConfig } from "./types.js";

export class BoundedQueue<T> {
  private items: T[] = [];
  private readonly max: number;
  private readonly onOverflow: NonNullable<QueueConfig["onOverflow"]>;

  constructor(cfg: QueueConfig = {}) {
    this.max = cfg.maxSize ?? 100;
    this.onOverflow = cfg.onOverflow ?? "drop-oldest";
  }

  push(item: T): { dropped?: T; rejected?: boolean } {
    if (this.items.length < this.max) {
      this.items.push(item);
      return {};
    }
    if (this.onOverflow === "drop-newest") {
      return { rejected: true };
    }
    if (this.onOverflow === "throw") {
      throw new Error("Queue overflow");
    }
    const dropped = this.items.shift();
    this.items.push(item);
    return dropped !== undefined ? { dropped } : {};
  }

  drain(): T[] {
    const items = this.items;
    this.items = [];
    return items;
  }

  get size(): number {
    return this.items.length;
  }
}
