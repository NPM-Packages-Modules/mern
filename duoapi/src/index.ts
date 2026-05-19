import type { ZodObject, ZodRawShape } from "zod";
import { z } from "zod";
export interface DualMeta<T extends ZodObject<ZodRawShape>> { name: string; schema: T }
export function duoapi<T extends ZodObject<ZodRawShape>>(m: DualMeta<T>) {
  const fields = Object.keys(m.schema.shape);
  const sdl = `type ${m.name} {\n${fields.map((f) => "  " + f + ": String").join("\n")}\n}\n\ntype Query { ${m.name.toLowerCase()}_by_id(id: ID!): ${m.name} }\n`;
  return { graphqlSDL: sdl, restBase: "/api/" + m.name.toLowerCase() + "s", fields, schema: m.schema };
}
export { z };
