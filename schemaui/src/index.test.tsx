import * as React from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SchemauiForm, schemaFields } from "./index.js";

describe("schemaui", () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().optional(),
    role: z.enum(["user", "admin"]),
    active: z.boolean().default(true),
  });

  it("schemaFields infers kinds", () => {
    const f = schemaFields(schema);
    expect(f.find((x) => x.key === "email")?.kind).toBe("string");
    expect(f.find((x) => x.key === "role")?.options).toEqual(["user", "admin"]);
    expect(f.find((x) => x.key === "active")?.kind).toBe("boolean");
  });

  it("renders form", () => {
    let state: Record<string, unknown> = { email: "", role: "user", active: true };
    const tr = TestRenderer.create(
      <SchemauiForm
        schema={schema}
        value={state}
        onChange={(n) => {
          state = n;
        }}
        errors={{ email: ["bad"] }}
      />
    );
    expect(tr.toJSON()).toBeTruthy();
  });
});
