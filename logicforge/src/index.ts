export type LogicCtx = Record<string, unknown>;

export type LogicPredicate = (ctx: LogicCtx) => boolean;

/** Safe subset: "key > number" or "key >= number" (whitespace flexible). */
export function logicforgePredicateFromIf(expr: string): LogicPredicate {
  const m = expr
    .trim()
    .match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(>|>=|<|<=)\s*([-+]?\d*\.?\d+)$/);
  if (!m) throw new Error("logicforge: unsupported if expression (use key > 100 style)");
  const key = m[1]!;
  const op = m[2]!;
  const numStr = m[3]!;
  const num = Number(numStr);
  return (ctx) => {
    const v = Number(ctx[key]);
    if (Number.isNaN(v)) return false;
    switch (op) {
      case ">":
        return v > num;
      case ">=":
        return v >= num;
      case "<":
        return v < num;
      case "<=":
        return v <= num;
      default:
        return false;
    }
  };
}

export function logicforgeRule(
  spec: { if: string },
  then?: (ctx: LogicCtx) => unknown
): { when: LogicPredicate; run?: (ctx: LogicCtx) => unknown } {
  const when = logicforgePredicateFromIf(spec.if);
  return { when, run: then };
}
