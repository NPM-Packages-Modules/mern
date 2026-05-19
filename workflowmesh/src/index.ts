export type StepFn<C extends object> = (ctx: C) => void | Promise<void>;
export type RollbackFn<C extends object> = (ctx: C) => void | Promise<void>;

export interface StepDef<C extends object> {
  name: string;
  run: StepFn<C>;
  /** Extra attempts after the first failure (0 = no retry) */
  retry?: number;
  retryDelayMs?: number;
  rollback?: RollbackFn<C>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function runStep<C extends object>(step: StepDef<C>, ctx: C): Promise<void> {
  const max = step.retry ?? 0;
  let attempt = 0;
  while (true) {
    try {
      await step.run(ctx);
      return;
    } catch (e) {
      if (attempt >= max) throw e;
      attempt += 1;
      await sleep(step.retryDelayMs ?? 50 * attempt);
    }
  }
}

export class WorkflowMesh<C extends object> {
  private readonly steps: StepDef<C>[] = [];

  step(def: StepDef<C>): this {
    this.steps.push(def);
    return this;
  }

  async run(ctx: C): Promise<C> {
    for (const s of this.steps) {
      await runStep(s, ctx);
    }
    return ctx;
  }

  /** Runs steps in order; on failure, invokes `rollback` on completed steps in reverse order. */
  async runWithRollback(ctx: C): Promise<C> {
    const done: StepDef<C>[] = [];
    try {
      for (const s of this.steps) {
        await runStep(s, ctx);
        done.push(s);
      }
      return ctx;
    } catch (e) {
      for (const s of done.reverse()) {
        await s.rollback?.(ctx);
      }
      throw e;
    }
  }
}

export function workflowMesh<C extends object>() {
  return new WorkflowMesh<C>();
}
