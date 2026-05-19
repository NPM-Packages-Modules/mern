import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { z } from "zod";

export { z };

export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      res.status(400).json({ error: "invalid_body", details: r.error.flatten() });
      return;
    }
    req.body = r.data as unknown;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const r = schema.safeParse(req.query);
    if (!r.success) {
      res.status(400).json({ error: "invalid_query", details: r.error.flatten() });
      return;
    }
    req.query = r.data as unknown as typeof req.query;
    next();
  };
}
