import type { NextFunction, Request, Response } from "express";
const ms = new Map<string, { count: number; ms: number }>();
export function metricpress() {
return (req: Request, res: Response, next: NextFunction) => { const t=Date.now(); res.on("finish", ()=>{ const key=req.method+" "+req.path; const x=ms.get(key)??{count:0,ms:0}; x.count++; x.ms+=Date.now()-t; ms.set(key,x); }); next(); }; }
export function metricpressSnapshot(){ return Object.fromEntries(ms); }
export function metricpressReset(){ ms.clear(); }
