import { z, type ZodTypeAny } from "zod";
export function configforgeLoad<S extends ZodTypeAny>(schema: S, layers: unknown[]) {
let acc: unknown = {};
for(const L of layers) acc = { ...(acc as object), ...(L as object) };
return schema.parse(acc) as z.infer<S>;
}
export { z };
