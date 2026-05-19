import * as React from "react";
import { z, type ZodDefault, type ZodObject, type ZodRawShape, type ZodTypeAny } from "zod";

export type FieldKind = "string" | "number" | "boolean" | "enum";

export interface SchemaField {
  key: string;
  kind: FieldKind;
  options?: string[];
}

function unwrap(zt: ZodTypeAny): ZodTypeAny {
  let cur: ZodTypeAny = zt;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) {
      cur = cur.unwrap();
      continue;
    }
    if (cur instanceof z.ZodDefault) {
      cur = (cur as ZodDefault<ZodTypeAny>)._def.innerType as ZodTypeAny;
      continue;
    }
    return cur;
  }
}

/** Introspect a shallow `z.object({...})` into input kinds for simple forms. */
export function schemaFields(schema: ZodObject<ZodRawShape>): SchemaField[] {
  const out: SchemaField[] = [];
  for (const [key, zt] of Object.entries(schema.shape)) {
    const base = unwrap(zt as ZodTypeAny);
    if (base instanceof z.ZodString) out.push({ key, kind: "string" });
    else if (base instanceof z.ZodNumber) out.push({ key, kind: "number" });
    else if (base instanceof z.ZodBoolean) out.push({ key, kind: "boolean" });
    else if (base instanceof z.ZodEnum) out.push({ key, kind: "enum", options: [...base.options] });
    else if (base instanceof z.ZodNativeEnum) {
      const en = base.enum as Record<string, string | number>;
      const opts = Object.values(en).map(String);
      out.push({ key, kind: "enum", options: [...new Set(opts)] });
    } else out.push({ key, kind: "string" });
  }
  return out;
}

export interface SchemauiFormProps<T extends ZodObject<ZodRawShape>> {
  schema: T;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  errors?: Record<string, string | string[] | undefined>;
}

export function SchemauiForm<T extends ZodObject<ZodRawShape>>({
  schema,
  value,
  onChange,
  errors,
}: SchemauiFormProps<T>) {
  const fields = React.useMemo(() => schemaFields(schema), [schema]);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {fields.map((f) => {
        const err = errors?.[f.key];
        const errText = Array.isArray(err) ? err.join(", ") : err;
        const firstOpt = f.options?.[0] ?? "";
        return (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{f.key}</div>
            {f.kind === "boolean" ? (
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(value[f.key])}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({ ...value, [f.key]: e.currentTarget.checked })
                  }
                />
              </label>
            ) : f.kind === "enum" && f.options?.length ? (
              <select
                value={String(value[f.key] ?? firstOpt)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange({ ...value, [f.key]: e.currentTarget.value })
                }
              >
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.kind === "number" ? (
              <input
                type="number"
                value={value[f.key] === undefined || value[f.key] === null ? "" : Number(value[f.key])}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange({
                    ...value,
                    [f.key]: e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value),
                  })
                }
              />
            ) : (
              <input
                type="text"
                value={String(value[f.key] ?? "")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...value, [f.key]: e.currentTarget.value })
                }
              />
            )}
            {errText ? <div style={{ color: "#b00020", fontSize: 12 }}>{errText}</div> : null}
          </div>
        );
      })}
    </form>
  );
}
