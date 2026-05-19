export type WH<T=unknown> = (j:T)=>void|Promise<void>;
export class WorkerForge { private m = new Map<string, WH[]>(); process<T=unknown>(n:string,h:WH<T>){const a=this.m.get(n)??[];a.push(h as WH);this.m.set(n,a);return this}
async dispatch<T=unknown>(n:string,p:T){ for(const h of this.m.get(n)??[])await(h as WH<T>)(p);} }
export const workerforge = () => new WorkerForge();
