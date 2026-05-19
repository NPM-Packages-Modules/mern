export interface RegisterOptions {
  /** Default true — reuse first resolved instance */
  singleton?: boolean;
}

export class InjectFlowContainer {
  private readonly singletons = new Map<string, unknown>();
  private readonly factories = new Map<string, () => unknown>();

  register<T>(token: string, factory: () => T, opts?: RegisterOptions): this {
    const singleton = opts?.singleton ?? true;
    this.factories.set(token, () => {
      if (singleton) {
        if (this.singletons.has(token)) return this.singletons.get(token);
        const inst = factory();
        this.singletons.set(token, inst);
        return inst;
      }
      return factory();
    });
    return this;
  }

  resolve<T>(token: string): T {
    const f = this.factories.get(token);
    if (!f) throw new Error(`injectflow: unknown token "${token}"`);
    return f() as T;
  }

  /** Clear singleton cache (useful in tests). */
  reset(): void {
    this.singletons.clear();
  }
}

export function injectflow(): InjectFlowContainer {
  return new InjectFlowContainer();
}
