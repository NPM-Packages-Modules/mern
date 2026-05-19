import crypto from "node:crypto";
import type { RequestHandler } from "express";

export type DeliveryRecord = { id: string; at: number; event?: string };

/** Timing-safe compare of two hex strings. */
export function verifyHmacSha256Hex(secret: string, rawBody: string, signatureHex: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signatureHex, "utf8"));
  } catch {
    return false;
  }
}

/** Supports `sha256=<hex>` (GitHub-style) or raw hex. */
export function verifyHmacSha256Header(secret: string, rawBody: string, headerValue: string): boolean {
  const v = headerValue.trim();
  const hex = v.startsWith("sha256=") ? v.slice(7) : v;
  return verifyHmacSha256Hex(secret, rawBody, hex);
}

export class HookRegistry {
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private deliveries = new Map<string, DeliveryRecord>();

  register(event: string, fn: (payload: unknown) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(event: string, payload: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  recordDelivery(id: string, event?: string): void {
    this.deliveries.set(id, { id, at: Date.now(), event });
  }

  wasDelivered(id: string): boolean {
    return this.deliveries.has(id);
  }
}

export interface WebhookGuardOptions {
  secret: string;
  /** Header carrying signature, default `x-hook-signature` */
  signatureHeader?: string;
  /** Idempotency header, default `x-idempotency-key` */
  idempotencyHeader?: string;
  /** Provide raw body string; if omitted, uses JSON.stringify(req.body) — prefer raw parser in production */
  getRawBody?: (req: Parameters<RequestHandler>[0]) => string | undefined;
}

/** Express middleware: verifies HMAC, dedupes idempotency keys, stores delivery id. */
export function webhookGuard(opts: WebhookGuardOptions): RequestHandler {
  const sigH = (opts.signatureHeader ?? "x-hook-signature").toLowerCase();
  const idemH = (opts.idempotencyHeader ?? "x-idempotency-key").toLowerCase();
  const store = new HookRegistry();

  return (req, res, next) => {
    const raw =
      opts.getRawBody?.(req) ??
      (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));
    const sig = req.headers[sigH] ?? req.headers[opts.signatureHeader ?? "x-hook-signature"];
    if (typeof sig !== "string" || !verifyHmacSha256Header(opts.secret, raw, sig)) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    const idem = req.headers[idemH];
    if (typeof idem === "string") {
      if (store.wasDelivered(idem)) {
        res.status(200).json({ ok: true, duplicate: true });
        return;
      }
      store.recordDelivery(idem);
    }
    next();
  };
}
