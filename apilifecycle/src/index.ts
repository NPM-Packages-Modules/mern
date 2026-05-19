import type { RequestHandler } from "express";
export function apilifecycleDeprecation(sunset: string): RequestHandler {
return (_req,res,next)=>{ res.setHeader("Deprecation","true"); res.setHeader("Sunset", sunset); next(); }; }
export function apilifecycleVersionGate(min: string, getVer: (req: { headers: { [k:string]: string|string[]|undefined }})=>string|undefined): RequestHandler {
return (req,res,next)=>{ const v=getVer(req as never); if(!v||v<min){res.status(426).json({error:"upgrade_client",min});return;} next(); };
}
