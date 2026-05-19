import type { ZodTypeAny } from "zod";

export interface FormBridgeOk<T> {
  success: true;
  data: T;
}

export interface FormBridgeErr {
  success: false;
  fieldErrors: Record<string, string[]>;
}

export type FormBridgeResult<T> = FormBridgeOk<T> | FormBridgeErr;

/**
 * Wrap a Zod schema so UI and HTTP handlers share one source of truth for form payloads.
 */
export function formbridge<T>(schema: ZodTypeAny) {
  return {
    validate(raw: unknown): FormBridgeResult<T> {
      const r = schema.safeParse(raw);
      if (r.success) return { success: true, data: r.data as T };
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of r.error.issues) {
        const key = issue.path.length ? issue.path.join(".") : "_root";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return { success: false, fieldErrors };
    },

    /** Normalize API JSON shaped like `{ details: { fieldErrors } }` (e.g. validora-style flatten). */
    errorsFromApiPayload(payload: unknown): Record<string, string[]> {
      if (!payload || typeof payload !== "object") return {};
      const details = (payload as { details?: unknown }).details;
      if (!details || typeof details !== "object") return {};
      const rawFe = (details as { fieldErrors?: unknown }).fieldErrors;
      if (!rawFe || typeof rawFe !== "object") return {};
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(rawFe as Record<string, unknown>)) {
        if (Array.isArray(v)) out[k] = v.map(String);
        else if (typeof v === "string") out[k] = [v];
      }
      return out;
    },
  };
}
