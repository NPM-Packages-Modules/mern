import type { Window, Dimension } from "./types.js";

export class CostLimitError extends Error {
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly window: Window;
  readonly dimension: Dimension;
  readonly dimensionKey: string;

  constructor(input: {
    limit: number;
    used: number;
    resetAt: Date;
    window: Window;
    dimension: Dimension;
    dimensionKey: string;
  }) {
    super(
      `cost-limiter: budget exhausted for ${input.dimension}=${input.dimensionKey} ` +
        `(${input.window}: $${input.used.toFixed(4)} / $${input.limit.toFixed(4)})`,
    );
    this.name = "CostLimitError";
    this.limit = input.limit;
    this.used = input.used;
    this.remaining = Math.max(0, input.limit - input.used);
    this.resetAt = input.resetAt;
    this.window = input.window;
    this.dimension = input.dimension;
    this.dimensionKey = input.dimensionKey;
    Object.setPrototypeOf(this, CostLimitError.prototype);
  }
}
