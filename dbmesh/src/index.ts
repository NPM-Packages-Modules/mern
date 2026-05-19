export interface DbMeshAdapter<T = Record<string, unknown>> {
  find(filter?: Partial<T>): Promise<T[]>;
}

export class DbMesh {
  private adapters = new Map<string, DbMeshAdapter<Record<string, unknown>>>();

  use<T extends Record<string, unknown>>(name: string, adapter: DbMeshAdapter<T>): this {
    this.adapters.set(name, adapter as DbMeshAdapter<Record<string, unknown>>);
    return this;
  }

  collection<T extends Record<string, unknown>>(name: string): { find: (f?: Partial<T>) => Promise<T[]> } {
    const a = this.adapters.get(name);
    if (!a) throw new Error("dbmesh: unknown collection " + name);
    return {
      find: (f?: Partial<T>) => a.find(f as never) as Promise<T[]>,
    };
  }

  get users(): { find: (f?: Partial<Record<string, unknown>>) => Promise<Record<string, unknown>[]> } {
    return this.collection("users");
  }
}

export const dbmesh = () => new DbMesh();
