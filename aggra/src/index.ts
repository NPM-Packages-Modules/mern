/** One aggregation stage document (`$match`, `$lookup`, …). */
export type AggStage = Record<string, unknown>;

export class AggraPipeline {
  private readonly stages: AggStage[] = [];

  match(expr: Record<string, unknown>): this {
    this.stages.push({ $match: expr });
    return this;
  }

  lookup(stage: Record<string, unknown>): this {
    this.stages.push({ $lookup: stage });
    return this;
  }

  group(stage: Record<string, unknown>): this {
    this.stages.push({ $group: stage });
    return this;
  }

  sort(stage: Record<string, unknown>): this {
    this.stages.push({ $sort: stage });
    return this;
  }

  project(stage: Record<string, unknown>): this {
    this.stages.push({ $project: stage });
    return this;
  }

  limit(n: number): this {
    this.stages.push({ $limit: n });
    return this;
  }

  skip(n: number): this {
    this.stages.push({ $skip: n });
    return this;
  }

  unwind(pathOrStage: string | Record<string, unknown>): this {
    if (typeof pathOrStage === "string") this.stages.push({ $unwind: pathOrStage });
    else this.stages.push({ $unwind: pathOrStage });
    return this;
  }

  /** Append a pre-built stage, e.g. `{ $facet: ... }`. */
  add(stage: AggStage): this {
    this.stages.push(stage);
    return this;
  }

  build(): AggStage[] {
    return [...this.stages];
  }

  /** Shallow clone for branching pipelines. */
  fork(): AggraPipeline {
    const p = new AggraPipeline();
    (p as unknown as { stages: AggStage[] }).stages = [...this.stages];
    return p;
  }
}

/** Start a fluent aggregation pipeline builder (`aggra` = aggregation). */
export function pipeline(): AggraPipeline {
  return new AggraPipeline();
}

export const aggra = { pipeline };
