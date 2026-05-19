import type { SchemaIndexSpec } from "./types.js";

export function isFieldIndexed(field: string, indexes: SchemaIndexSpec[]): boolean {
  if (field === "_id" || field === "id") return true;
  return indexes.some((spec) => spec.fields.includes(field) || spec.fields[0] === field);
}

export function indexCoversFields(filterFields: string[], indexes: SchemaIndexSpec[]): boolean {
  if (filterFields.length === 0) return true;
  return indexes.some((spec) => filterFields.every((f) => spec.fields.includes(f)));
}

export function unindexedFields(filterFields: string[], indexes: SchemaIndexSpec[]): string[] {
  return filterFields.filter((f) => !isFieldIndexed(f, indexes));
}

export function suggestCompoundIndex(filterFields: string[]): SchemaIndexSpec {
  return { fields: [...filterFields].sort() };
}

export function isFullScan(filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return true;
  return Object.keys(filter as Record<string, unknown>).length === 0;
}
