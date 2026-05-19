/** Track which cache **tags** depend on domain keys like `User:u1` or `Org:o9`. */
export class CacheFlow {
  private readonly tagDeps = new Map<string, Set<string>>();
  private readonly depTags = new Map<string, Set<string>>();

  /** Declare that HTTP/cache tag `tag` must be purged when any `deps` entity mutates. */
  track(tag: string, deps: string[]): this {
    if (!this.tagDeps.has(tag)) this.tagDeps.set(tag, new Set());
    const ds = this.tagDeps.get(tag)!;
    for (const d of deps) {
      ds.add(d);
      if (!this.depTags.has(d)) this.depTags.set(d, new Set());
      this.depTags.get(d)!.add(tag);
    }
    return this;
  }

  /** Mark `deps` as dirty — returns affected tags and clears their bookkeeping. */
  invalidateDeps(...deps: string[]): Set<string> {
    const tags = new Set<string>();
    for (const d of deps) {
      for (const t of this.depTags.get(d) ?? []) tags.add(t);
    }
    for (const t of tags) this.forgetTag(t);
    return tags;
  }

  forgetTag(tag: string): void {
    const ds = this.tagDeps.get(tag);
    if (!ds) return;
    for (const d of ds) this.depTags.get(d)?.delete(tag);
    this.tagDeps.delete(tag);
  }
}

export function cacheflow(): CacheFlow {
  return new CacheFlow();
}
