import type { RequestHandler, Router } from "express"; import { Router as R } from "express";
export class CtrlFlow { private s: RequestHandler[] = []; use(...m: RequestHandler[]){this.s.push(...m);return this}
mount(router: Router, setup?: (r: Router)=>void){for(const m of this.s)router.use(m);setup?.(router);return router} toRouter(setup?: (r: Router)=>void){return this.mount(R(),setup)}}
export const ctrlflow = () => new CtrlFlow();
