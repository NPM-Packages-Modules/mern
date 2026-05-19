export interface HA { at: number; error?: string; status?: number }
export class HookRetry { private m = new Map<string, HA[]>(); record(id:string,a:HA){const x=this.m.get(id)??[];x.push(a);this.m.set(id,x);}
nextBackoffMs(i:number,b=200){return Math.min(60000,b*2**i)} history(id:string){return [...(this.m.get(id)??[])]} }
export const hookretry = () => new HookRetry();
