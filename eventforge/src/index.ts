type L<T=unknown> = (e:T)=>void|Promise<void>;
export class EventForge { private m = new Map<string, L[]>();
on<T=unknown>(ev: string, fn: L<T>){ const a=this.m.get(ev)??[]; a.push(fn as L); this.m.set(ev,a); return this; }
async emit<T=unknown>(ev: string, payload: T){ for(const fn of this.m.get(ev)??[]) await (fn as L<T>)(payload); } }
export const eventforge = () => new EventForge();
