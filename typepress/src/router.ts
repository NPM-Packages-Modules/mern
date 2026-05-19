import type { HttpMethod, RouteContext, RouteDefinition, RouteDescriptor } from "./types.js";

export type TypepressErrorBody = {
  success: false;
  error: { code: string; message: string; field?: string };
};

type ReqLike = {
  method?: string;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  url?: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
};
type ResLike = {
  status(code: number): ResLike;
  json(body: unknown): ResLike;
  end(): void;
  headersSent?: boolean;
};
type NextLike = (err?: unknown) => void;

type ExpressLikeRouter = {
  get?: (path: string, handler: (...args: unknown[]) => unknown) => unknown;
  post?: (path: string, handler: (...args: unknown[]) => unknown) => unknown;
  put?: (path: string, handler: (...args: unknown[]) => unknown) => unknown;
  patch?: (path: string, handler: (...args: unknown[]) => unknown) => unknown;
  delete?: (path: string, handler: (...args: unknown[]) => unknown) => unknown;
};

export class Typepress {
  private routes: RouteDefinition<unknown, unknown, unknown, unknown>[] = [];

  add<TBody, TQuery, TParams, TResponse>(
    route: RouteDefinition<TBody, TQuery, TParams, TResponse>,
  ): this {
    this.routes.push(route as RouteDefinition<unknown, unknown, unknown, unknown>);
    return this;
  }

  get<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown>(
    path: string,
    handler: RouteDefinition<TBody, TQuery, TParams, TResponse>["handler"],
    schemas?: RouteDefinition<TBody, TQuery, TParams, TResponse>["schemas"],
  ): this {
    return this.add<TBody, TQuery, TParams, TResponse>({ method: "get", path, handler, schemas });
  }

  post<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown>(
    path: string,
    handler: RouteDefinition<TBody, TQuery, TParams, TResponse>["handler"],
    schemas?: RouteDefinition<TBody, TQuery, TParams, TResponse>["schemas"],
  ): this {
    return this.add<TBody, TQuery, TParams, TResponse>({ method: "post", path, handler, schemas });
  }

  put<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown>(
    path: string,
    handler: RouteDefinition<TBody, TQuery, TParams, TResponse>["handler"],
    schemas?: RouteDefinition<TBody, TQuery, TParams, TResponse>["schemas"],
  ): this {
    return this.add<TBody, TQuery, TParams, TResponse>({ method: "put", path, handler, schemas });
  }

  patch<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown>(
    path: string,
    handler: RouteDefinition<TBody, TQuery, TParams, TResponse>["handler"],
    schemas?: RouteDefinition<TBody, TQuery, TParams, TResponse>["schemas"],
  ): this {
    return this.add<TBody, TQuery, TParams, TResponse>({ method: "patch", path, handler, schemas });
  }

  delete<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown>(
    path: string,
    handler: RouteDefinition<TBody, TQuery, TParams, TResponse>["handler"],
    schemas?: RouteDefinition<TBody, TQuery, TParams, TResponse>["schemas"],
  ): this {
    return this.add<TBody, TQuery, TParams, TResponse>({ method: "delete", path, handler, schemas });
  }

  attach(router: ExpressLikeRouter): void {
    for (const route of this.routes) {
      const fn = router[route.method as HttpMethod];
      if (typeof fn !== "function") continue;
      fn.call(router, route.path, createHandler(route) as unknown as (...args: unknown[]) => unknown);
    }
  }

  list(): RouteDescriptor[] {
    return this.routes.map((r) => ({
      method: r.method,
      path: r.path,
      summary: r.summary,
      tags: r.tags,
      body: r.schemas?.body?.describe(),
      query: r.schemas?.query?.describe(),
      params: r.schemas?.params?.describe(),
      response: r.schemas?.response?.describe(),
    }));
  }
}

function createHandler(route: RouteDefinition<unknown, unknown, unknown, unknown>) {
  return async (req: ReqLike, res: ResLike, next: NextLike) => {
    try {
      const ctx = await buildContext(route, req);
      if ("error" in ctx) {
        sendError(res, ctx);
        return;
      }
      const result = await Promise.resolve(route.handler(ctx.context));
      if (route.schemas?.response) {
        const parsed = route.schemas.response.parse(result, "response");
        if (!parsed.success) {
          sendError(res, {
            error: { code: "RESPONSE_VALIDATION", message: parsed.error, status: 500 },
          });
          return;
        }
        res.status(200).json(parsed.data);
      } else {
        if (result === undefined) {
          res.status(204).end();
        } else {
          res.status(200).json(result);
        }
      }
    } catch (err) {
      next(err);
    }
  };
}

function sendError(res: ResLike, info: { error: { code: string; message: string; field?: string; status?: number } }): void {
  if (res.headersSent) return;
  const status = info.error.status ?? 400;
  const body: TypepressErrorBody = {
    success: false,
    error: { code: info.error.code, message: info.error.message },
  };
  if (info.error.field) body.error.field = info.error.field;
  res.status(status).json(body);
}

interface BuiltContext<TBody, TQuery, TParams> {
  context: RouteContext<TBody, TQuery, TParams>;
}

async function buildContext(
  route: RouteDefinition<unknown, unknown, unknown, unknown>,
  req: ReqLike,
): Promise<BuiltContext<unknown, unknown, unknown> | { error: { code: string; message: string; field: string; status: number } }> {
  const schemas = route.schemas;
  let body: unknown = req.body ?? {};
  let query: unknown = req.query ?? {};
  let params: unknown = req.params ?? {};

  if (schemas?.body) {
    const r = schemas.body.parse(body, "body");
    if (!r.success) return { error: errorFromParse("body", r.error) };
    body = r.data;
  }
  if (schemas?.query) {
    const r = schemas.query.parse(query, "query");
    if (!r.success) return { error: errorFromParse("query", r.error) };
    query = r.data;
  }
  if (schemas?.params) {
    const r = schemas.params.parse(params, "params");
    if (!r.success) return { error: errorFromParse("params", r.error) };
    params = r.data;
  }

  return {
    context: {
      body,
      query,
      params,
      req,
    } as RouteContext<unknown, unknown, unknown>,
  };
}

function errorFromParse(field: string, message: string) {
  return { code: "VALIDATION_ERROR", message, field, status: 400 };
}
