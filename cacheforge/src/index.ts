export interface CEntry<T> { value: T; expiresAt: number; tags: string[] }
export class CacheForge { private store = new Map<string, CEntry<unknown>>();
set<T>(k: string, v: T, ttlMs: number, tags: string[] = []) { this.store.set(k, { value: v, expiresAt: Date.now()+ttlMs, tags }); }
get<T>(k: string): T|undefined { const e=this.store.get(k); if(!e||e.expiresAt<Date.now()) return undefined; return e.value as T; }
invalidateTag(t: string){ for(const [k,e] of this.store){ if(e.tags.includes(t)) this.store.delete(k); } } }
export const cacheforge = () => new CacheForge();
