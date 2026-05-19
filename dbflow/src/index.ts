export interface Repo<T, F> { findMany(filter: F): Promise<T[]>; findOne(filter: F): Promise<T|null>; save(doc: T): Promise<T>; remove(filter: F): Promise<number> }
export function dbflowRepo<T, F>(impl: Repo<T,F>): Repo<T,F> { return impl; }
