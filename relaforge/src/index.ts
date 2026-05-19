export function relaforgePaths(paths: string[], maxDepth = 5): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const segs = p.split(".").filter(Boolean);
    if (segs.length > maxDepth) continue;
    const seen = new Set<string>(); let bad = false;
    for (const s of segs) { if (seen.has(s)) { bad = true; break; } seen.add(s); }
    if (!bad) out.push(segs.join("."));
  } return out;
}
export const relaforgeNest = (a: string, b: string) => a + "." + b;
