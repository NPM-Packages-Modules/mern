export interface SH<T> { beforeCreate?: (d:T)=>void|Promise<void>; afterCreate?: (d:T)=>void|Promise<void> }
export class ServiceForge<T> { constructor(readonly name: string, private h: SH<T> = {}) {} async create(d:T): Promise<T> { await this.h.beforeCreate?.(d); await this.h.afterCreate?.(d); return d; } }
export const serviceForge = <T>(n: string, h?: SH<T>) => new ServiceForge<T>(n,h);
