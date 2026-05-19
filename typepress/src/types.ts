import type { Schema, SchemaDescriptor } from "./schema.js";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface RouteSchemas<TBody, TQuery, TParams, TResponse> {
  body?: Schema<TBody>;
  query?: Schema<TQuery>;
  params?: Schema<TParams>;
  response?: Schema<TResponse>;
}

export interface RouteContext<TBody, TQuery, TParams> {
  body: TBody;
  query: TQuery;
  params: TParams;
  req: {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    [key: string]: unknown;
  };
}

export interface RouteDefinition<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown> {
  method: HttpMethod;
  path: string;
  summary?: string;
  tags?: string[];
  schemas?: RouteSchemas<TBody, TQuery, TParams, TResponse>;
  handler: (ctx: RouteContext<TBody, TQuery, TParams>) => Promise<TResponse> | TResponse;
}

export interface RouteDescriptor {
  method: HttpMethod;
  path: string;
  summary?: string;
  tags?: string[];
  body?: SchemaDescriptor;
  query?: SchemaDescriptor;
  params?: SchemaDescriptor;
  response?: SchemaDescriptor;
}

export interface OpenApiOptions {
  title?: string;
  version?: string;
  description?: string;
  servers?: Array<{ url: string; description?: string }>;
}
