export class LockMesh { private locks = new Map<string, number>();
async withLock<T>(key: string, ttlMs: number, fn: ()=>Promise<T>): Promise<T> {
const now=Date.now(); const until=this.locks.get(key)??0; if(until>now) throw new Error("lockmesh: busy "+key);
this.locks.set(key, now+ttlMs); try { return await fn(); } finally { this.locks.delete(key); } } }
export const lockmesh = () => new LockMesh();
