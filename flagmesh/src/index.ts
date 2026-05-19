export type FlagRule =
  | { kind: "boolean"; value: boolean }
  | { kind: "percent"; value: number }
  | { kind: "env"; varName: string; whenMissing?: boolean };

export type FlagContext = { userId?: string; defaultKey?: string };

function stableBucket(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

/** Hash percent rollout: same userId + flag → stable in/out. */
export function percentEnabled(flagKey: string, pct: number, ctx?: FlagContext): boolean {
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  const key = `${flagKey}|${ctx?.userId ?? ctx?.defaultKey ?? "anon"}`;
  return stableBucket(key) < pct;
}

export class Flagmesh {
  private rules = new Map<string, FlagRule>();

  constructor(initial?: Record<string, boolean | FlagRule>) {
    if (!initial) return;
    for (const [k, v] of Object.entries(initial)) {
      if (typeof v === "boolean") this.rules.set(k, { kind: "boolean", value: v });
      else this.rules.set(k, v);
    }
  }

  setRule(flag: string, rule: FlagRule) {
    this.rules.set(flag, rule);
  }

  isEnabled(flag: string, ctx?: FlagContext): boolean {
    const r = this.rules.get(flag);
    if (!r) return false;
    if (r.kind === "boolean") return r.value;
    if (r.kind === "percent") return percentEnabled(flag, r.value, ctx);
    const raw = process.env[r.varName];
    if (raw === "1" || raw?.toLowerCase() === "true") return true;
    if (raw === "0" || raw?.toLowerCase() === "false") return false;
    return r.whenMissing ?? false;
  }
}

/** Default singleton-style helper */
let _default: Flagmesh | undefined;
export function flagmesh(): Flagmesh {
  if (!_default) _default = new Flagmesh();
  return _default;
}

export function flagmeshIsEnabled(flag: string, ctx?: FlagContext): boolean {
  return flagmesh().isEnabled(flag, ctx);
}
