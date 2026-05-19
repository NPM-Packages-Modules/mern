export interface Plug<T> { name: string; init: (ctx: T) => void | Promise<void> }
export class PlugStack<T> { private plugs: Plug<T>[] = []; use(p: Plug<T>){ this.plugs.push(p); return this; }
async boot(ctx: T){ for(const p of this.plugs) await p.init(ctx); } }
export const plugstack = <T>() => new PlugStack<T>();
