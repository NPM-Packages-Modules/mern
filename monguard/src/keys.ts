export function extractFilterFields(filter: unknown, prefix = ""): string[] {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) return [];
  const out = new Set<string>();
  for (const [k, v] of Object.entries(filter as Record<string, unknown>)) {
    if (k === "$or" || k === "$and" || k === "$nor") {
      if (Array.isArray(v)) for (const child of v) extractFilterFields(child).forEach((f) => out.add(f));
      continue;
    }
    if (k.startsWith("$")) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && hasOperator(v as Record<string, unknown>)) {
      out.add(path);
      continue;
    }
    out.add(path);
  }
  return Array.from(out);
}

function hasOperator(o: Record<string, unknown>): boolean {
  return Object.keys(o).some((k) => k.startsWith("$"));
}

export function fingerprintFilter(filter: unknown): string {
  if (!filter || typeof filter !== "object") return JSON.stringify(filter ?? {});
  if (Array.isArray(filter)) return `[${filter.map(fingerprintFilter).join(",")}]`;
  const entries = Object.entries(filter as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${shapeOf(v)}`);
  return `{${entries.join(",")}}`;
}

function shapeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.length ? shapeOf(v[0]) : ""}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Object.keys(o).some((k) => k.startsWith("$"))) {
      return `{${Object.keys(o).filter((k) => k.startsWith("$")).sort().join(",")}}`;
    }
    return fingerprintFilter(v);
  }
  return typeof v;
}

export function fingerprintQuery(op: string, collection: string, filter: unknown): string {
  return `${op}::${collection}::${fingerprintFilter(filter)}`;
}
