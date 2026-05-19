import type { Typepress } from "./router.js";
import type { OpenApiOptions, RouteDescriptor } from "./types.js";
import type { SchemaDescriptor } from "./schema.js";

export function toOpenApi(typepress: Typepress, options: OpenApiOptions = {}): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of typepress.list()) {
    const path = expressPathToOpenApi(route.path);
    const item = paths[path] ?? {};
    item[route.method] = routeToOperation(route);
    paths[path] = item;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "API",
      version: options.version ?? "0.1.0",
      description: options.description,
    },
    servers: options.servers,
    paths,
  };
}

function routeToOperation(route: RouteDescriptor): Record<string, unknown> {
  const parameters: Array<Record<string, unknown>> = [];
  if (route.params) addParametersFromObject("path", route.params, parameters, true);
  if (route.query) addParametersFromObject("query", route.query, parameters, false);
  const operation: Record<string, unknown> = {
    summary: route.summary,
    tags: route.tags,
    parameters: parameters.length ? parameters : undefined,
    responses: {
      "200": {
        description: "Successful response",
        content: route.response ? { "application/json": { schema: toJsonSchema(route.response) } } : undefined,
      },
      "400": { description: "Validation error" },
    },
  };
  if (route.body) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: toJsonSchema(route.body) } },
    };
  }
  return operation;
}

function addParametersFromObject(
  loc: "path" | "query",
  descriptor: SchemaDescriptor,
  output: Array<Record<string, unknown>>,
  alwaysRequired: boolean,
): void {
  if (descriptor.type !== "object") return;
  for (const [key, schema] of Object.entries(descriptor.properties)) {
    output.push({
      name: key,
      in: loc,
      required: alwaysRequired ? true : descriptor.required.includes(key),
      schema: toJsonSchema(schema),
    });
  }
}

export function toJsonSchema(descriptor: SchemaDescriptor): Record<string, unknown> {
  switch (descriptor.type) {
    case "string": {
      const s: Record<string, unknown> = { type: "string" };
      if ("min" in descriptor && descriptor.min !== undefined) s.minLength = descriptor.min;
      if ("max" in descriptor && descriptor.max !== undefined) s.maxLength = descriptor.max;
      if ("pattern" in descriptor && descriptor.pattern) s.pattern = descriptor.pattern;
      if ("format" in descriptor && descriptor.format) s.format = descriptor.format;
      return s;
    }
    case "number": {
      const s: Record<string, unknown> = { type: descriptor.integer ? "integer" : "number" };
      if (descriptor.min !== undefined) s.minimum = descriptor.min;
      if (descriptor.max !== undefined) s.maximum = descriptor.max;
      return s;
    }
    case "boolean":
      return { type: "boolean" };
    case "literal":
      return { const: descriptor.value };
    case "enum":
      return { type: "string", enum: descriptor.values };
    case "array":
      return {
        type: "array",
        items: toJsonSchema(descriptor.items),
        minItems: descriptor.min,
        maxItems: descriptor.max,
      };
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(descriptor.properties)) {
        properties[k] = toJsonSchema(v);
      }
      return {
        type: "object",
        properties,
        required: descriptor.required.length ? descriptor.required : undefined,
        additionalProperties: false,
      };
    }
    case "optional":
      return toJsonSchema(descriptor.inner);
    case "union":
      return { oneOf: descriptor.options.map(toJsonSchema) };
    case "null":
      return { type: "null" };
    case "unknown":
    default:
      return {};
  }
}

export function expressPathToOpenApi(path: string): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
}
