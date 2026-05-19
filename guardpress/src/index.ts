import type { Request, RequestHandler } from "express";
export type GF = (req: Request)=>boolean|Promise<boolean>;
export function guardpress(...g: GF[]): RequestHandler { return async (req,res,next)=>{ for(const x of g){ if(!(await x(req))){ res.status(403).json({error:"forbidden"}); return; } } next(); }; }
export const guardRole = (get:(req:Request)=>string|undefined, ok: Set<string>): GF => (req) => { const r=get(req); return !!r&&ok.has(r); };
