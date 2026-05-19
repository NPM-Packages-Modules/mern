import type { Request, RequestHandler } from "express";

export class PolicyFlow {
  private readonly parent = new Map<string, string | undefined>();
  private readonly allow = new Map<string, Set<string>>();

  /** Child role inherits any `allow` entries from `parentRole`. */
  inherits(childRole: string, parentRole: string | undefined): this {
    this.parent.set(childRole, parentRole);
    return this;
  }

  /** Grant `action` (e.g. `posts.create` or `*`) to `role`. */
  allowAction(role: string, action: string): this {
    if (!this.allow.has(role)) this.allow.set(role, new Set());
    this.allow.get(role)!.add(action);
    return this;
  }

  private effectiveRoles(role: string): Set<string> {
    const s = new Set<string>();
    let cur: string | undefined = role;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      s.add(cur);
      cur = this.parent.get(cur);
    }
    return s;
  }

  can(role: string | undefined, action: string): boolean {
    if (!role) return false;
    for (const r of this.effectiveRoles(role)) {
      const set = this.allow.get(r);
      if (!set) continue;
      if (set.has("*") || set.has(action)) return true;
    }
    return false;
  }

  /** Express middleware: reads role from `getter(req)` (e.g. JWT payload). */
  require(getter: (req: Request) => string | undefined, action: string): RequestHandler {
    return (req, res, next) => {
      if (this.can(getter(req), action)) {
        next();
        return;
      }
      res.status(403).json({ error: "forbidden", action });
    };
  }
}

export function policyflow(): PolicyFlow {
  return new PolicyFlow();
}
