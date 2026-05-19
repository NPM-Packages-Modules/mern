import type { NextFunction, Request, RequestHandler, Response } from "express";
export function midflow(...m: RequestHandler[]): RequestHandler {
return (req: Request, res: Response, next: NextFunction) => { let i = 0; const run = (err?: unknown) => {
if(err)return next(err); if(i>=m.length)return next(); const fn=m[i++]!; Promise.resolve(fn(req,res,run as NextFunction)).catch(next);
}; run(); }; }
