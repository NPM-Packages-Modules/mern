export type US<T> = (f:T)=>void|Promise<void>;
export class UploadFlow<T> { private s: US<T>[] = []; step(_: string, fn: US<T>){this.s.push(fn);return this} async run(f:T){for(const x of this.s)await x(f);} }
export const uploadflow = <T>() => new UploadFlow<T>();
