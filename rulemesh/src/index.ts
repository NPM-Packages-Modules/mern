export type RuleAction<Context> = (ctx: Context) => void | Promise<void>;
export type RuleMatch<Context> = (ctx: Context) => boolean;

interface Rule<Context> {
  event: string;
  match?: RuleMatch<Context>;
  run: RuleAction<Context>;
  /** Lower runs first when ties; default insertion order */
  priority?: number;
}

export class RuleMesh<Context = unknown> {
  private readonly rules: Rule<Context>[] = [];

  /**
   * Register a reaction to `event`. Optional `match` filters payloads; `priority` orders execution.
   */
  when(event: string, run: RuleAction<Context>, match?: RuleMatch<Context>, priority = 0): this {
    this.rules.push({ event, run, match, priority });
    return this;
  }

  /** Invoke every matching rule sequentially (await each). */
  async emit(event: string, ctx: Context): Promise<void> {
    const batch = this.rules
      .filter((r) => r.event === event)
      .filter((r) => (r.match ? r.match(ctx) : true))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    for (const r of batch) await r.run(ctx);
  }
}

export function ruleMesh<Context = unknown>(): RuleMesh<Context> {
  return new RuleMesh<Context>();
}
