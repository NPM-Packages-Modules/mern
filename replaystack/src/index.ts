export type CapturedRequest = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

function buildUrl(baseUrl: string, reqUrl: string): string {
  if (reqUrl.startsWith("http://") || reqUrl.startsWith("https://")) return reqUrl;
  const b = baseUrl.replace(/\/$/, "");
  const u = reqUrl.startsWith("/") ? reqUrl : `/${reqUrl}`;
  return `${b}${u}`;
}

/** Replay one captured request using global `fetch`. */
export async function replayOne(
  baseUrl: string,
  cap: CapturedRequest,
  init?: RequestInit,
): Promise<Response> {
  const url = buildUrl(baseUrl, cap.url);
  const headers = new Headers(init?.headers);
  for (const [k, v] of Object.entries(cap.headers ?? {})) {
    if (k.toLowerCase() === "host" || k.toLowerCase() === "content-length") continue;
    headers.set(k, v);
  }
  let body: string | undefined;
  if (cap.body !== undefined) body = typeof cap.body === "string" ? cap.body : JSON.stringify(cap.body);
  return fetch(url, {
    ...init,
    method: cap.method.toUpperCase(),
    headers,
    body: cap.method.toUpperCase() === "GET" || cap.method.toUpperCase() === "HEAD" ? undefined : body,
  });
}

export async function replayAll(
  baseUrl: string,
  captures: CapturedRequest[],
  init?: RequestInit,
): Promise<{ cap: CapturedRequest; status: number }[]> {
  const out: { cap: CapturedRequest; status: number }[] = [];
  for (const cap of captures) {
    const res = await replayOne(baseUrl, cap, init);
    out.push({ cap, status: res.status });
  }
  return out;
}

export function parseCaptureList(raw: unknown): CapturedRequest[] {
  if (!Array.isArray(raw)) throw new Error("expected JSON array of captures");
  return raw.map((x) => {
    if (!x || typeof x !== "object") throw new Error("invalid capture");
    const o = x as Record<string, unknown>;
    const method = String(o.method ?? "GET");
    const url = String(o.url ?? "");
    if (!url) throw new Error("capture missing url");
    return {
      method,
      url,
      headers: (o.headers as Record<string, string>) ?? undefined,
      body: o.body ?? undefined,
    };
  });
}
