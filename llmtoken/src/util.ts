export type ByteSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>
  | { body: ReadableStream<Uint8Array> | null }
  | null
  | undefined;

export async function* toByteIterator(src: ByteSource): AsyncIterable<Uint8Array> {
  if (!src) return;
  if ("body" in (src as { body?: unknown }) && (src as { body?: unknown }).body) {
    yield* toByteIterator((src as { body: ReadableStream<Uint8Array> }).body);
    return;
  }
  const anyStream = src as ReadableStream<Uint8Array> & AsyncIterable<Uint8Array>;
  if (typeof (anyStream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    for await (const chunk of anyStream as AsyncIterable<Uint8Array>) yield chunk;
    return;
  }
  if (typeof anyStream.getReader === "function") {
    const reader = anyStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export async function* lineIterator(src: ByteSource): AsyncIterable<string> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  for await (const chunk of toByteIterator(src)) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      yield line.endsWith("\r") ? line.slice(0, -1) : line;
    }
  }
  buffer += decoder.decode();
  if (buffer.length > 0) yield buffer;
}

export interface SSEEvent {
  event: string | null;
  data: string;
  id: string | null;
  retry: number | null;
}

export async function* sseIterator(src: ByteSource): AsyncIterable<SSEEvent> {
  let event: string | null = null;
  let id: string | null = null;
  let retry: number | null = null;
  let data: string[] = [];

  for await (const rawLine of lineIterator(src)) {
    if (rawLine === "") {
      if (data.length > 0 || event !== null) {
        yield { event, data: data.join("\n"), id, retry };
      }
      event = null;
      data = [];
      retry = null;
      continue;
    }
    if (rawLine.startsWith(":")) continue;
    const colon = rawLine.indexOf(":");
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    let value = colon === -1 ? "" : rawLine.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
    else if (field === "retry") {
      const n = Number(value);
      if (Number.isFinite(n)) retry = n;
    }
  }
  if (data.length > 0 || event !== null) {
    yield { event, data: data.join("\n"), id, retry };
  }
}
