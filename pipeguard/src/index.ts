import type { RequestHandler } from "express"; import type { ZodTypeAny } from "zod";
export const pipeguardBody = (s: ZodTypeAny): RequestHandler => (req,res,next)=>{ const r=s.safeParse(req.body); if(!r.success){res.status(400).json({error:"invalid_body",details:r.error.flatten()});return;}
req.body=r.data as unknown; next(); };
