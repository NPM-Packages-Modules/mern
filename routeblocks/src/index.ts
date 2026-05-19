import type { RequestHandler, Router } from "express"; import { Router as R } from "express";
export class RouteBlocks { private m: RequestHandler[] = []; auth(...mw: RequestHandler[]){ this.m.push(...mw); return this; }
build(fn:(r:Router)=>void): Router { const r=R(); for(const x of this.m) r.use(x); fn(r); return r; } }
export const routeblocks = () => new RouteBlocks();
