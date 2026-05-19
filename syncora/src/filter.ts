import type { Filter, SyncDocument } from "./types.js";

export function matches(doc: SyncDocument, filter: Filter | undefined): boolean {
  if (!filter) return true;
  for (const [key, expected] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(expected)) {
      if (!expected.some((sub) => matches(doc, sub as Filter))) return false;
      continue;
    }
    if (key === "$and" && Array.isArray(expected)) {
      if (!expected.every((sub) => matches(doc, sub as Filter))) return false;
      continue;
    }
    const actual = lookupPath(doc as Record<string, unknown>, key);
    if (!matchValue(actual, expected)) return false;
  }
  return true;
}

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const exp = expected as Record<string, unknown>;
    if (Object.keys(exp).some((k) => k.startsWith("$"))) {
      for (const [op, val] of Object.entries(exp)) {
        switch (op) {
          case "$eq": if (actual !== val) return false; break;
          case "$ne": if (actual === val) return false; break;
          case "$in":
            if (!Array.isArray(val) || !val.includes(actual)) return false;
            break;
          case "$nin":
            if (!Array.isArray(val) || val.includes(actual)) return false;
            break;
          case "$gt": if (!(typeof actual === "number" && typeof val === "number" && actual > val)) return false; break;
          case "$gte": if (!(typeof actual === "number" && typeof val === "number" && actual >= val)) return false; break;
          case "$lt": if (!(typeof actual === "number" && typeof val === "number" && actual < val)) return false; break;
          case "$lte": if (!(typeof actual === "number" && typeof val === "number" && actual <= val)) return false; break;
          case "$exists":
            if (Boolean(val) !== (actual !== undefined)) return false;
            break;
          default:
            return false;
        }
      }
      return true;
    }
  }
  return actual === expected;
}

function lookupPath(source: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return source[path];
  let cur: unknown = source;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}
