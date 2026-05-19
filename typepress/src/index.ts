export { Typepress } from "./router.js";
export type { TypepressErrorBody } from "./router.js";
export { toOpenApi, toJsonSchema, expressPathToOpenApi } from "./openapi.js";
export { generateTypescriptClient, schemaToTs } from "./client-gen.js";
export {
  t,
  string,
  number,
  boolean,
  literal,
  enums,
  array,
  object,
  optional,
  unknown,
  union,
} from "./schema.js";
export type { Schema, SchemaResult, SchemaDescriptor, Infer, ObjectShape, InferShape } from "./schema.js";
export type {
  HttpMethod,
  RouteContext,
  RouteDefinition,
  RouteSchemas,
  RouteDescriptor,
  OpenApiOptions,
} from "./types.js";

import { Typepress } from "./router.js";

export function createTypepress(): Typepress {
  return new Typepress();
}
