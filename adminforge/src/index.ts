export type AdminFieldType = "string" | "number" | "boolean" | "date" | "id" | "json";

export interface AdminFieldDef {
  key: string;
  label?: string;
  type: AdminFieldType;
  readonly?: boolean;
  relation?: { resource: string; labelField?: string };
}

export interface AdminModelDef {
  /** Singular resource name */
  name: string;
  /** API base path, e.g. `/api/users` */
  path: string;
  fields: AdminFieldDef[];
}

export interface AdminManifest {
  version: 1;
  generatedAt: string;
  models: AdminModelDef[];
}

export function adminModel(def: AdminModelDef): AdminModelDef {
  return def;
}

/** Produce a portable admin manifest for UI generators. */
export function buildAdminManifest(models: AdminModelDef[], generatedAt = new Date().toISOString()): AdminManifest {
  return { version: 1, generatedAt, models };
}

export const adminforge = { adminModel, buildAdminManifest };
