import type { ByteSource } from "./util.js";
import {
  StreamParseError,
  type ParseStreamOptions,
  type StreamChunk,
  type CollectedMessage,
  type Provider,
} from "./types.js";
import { parseOpenAIStream } from "./providers/openai.js";
import { parseAnthropicStream } from "./providers/anthropic.js";
import { parseGeminiStream } from "./providers/gemini.js";
import { parseGroqStream } from "./providers/groq.js";
import { parseDeepSeekStream } from "./providers/deepseek.js";
import { parseOllamaStream } from "./providers/ollama.js";

export type {
  StreamChunk,
  TextChunk,
  ToolCallChunk,
  ReasoningChunk,
  ErrorChunk,
  DoneChunk,
  ParseStreamOptions,
  CollectedMessage,
  Provider,
} from "./types.js";
export { StreamParseError } from "./types.js";
export { parseOpenAIStream } from "./providers/openai.js";
export { parseAnthropicStream } from "./providers/anthropic.js";
export { parseGeminiStream } from "./providers/gemini.js";
export { parseGroqStream } from "./providers/groq.js";
export { parseDeepSeekStream } from "./providers/deepseek.js";
export { parseOllamaStream } from "./providers/ollama.js";

export function parseStream(
  src: ByteSource,
  opts: ParseStreamOptions,
): AsyncIterable<StreamChunk> {
  switch (opts.provider) {
    case "openai":
      return parseOpenAIStream(src);
    case "anthropic":
      return parseAnthropicStream(src);
    case "gemini":
      return parseGeminiStream(src);
    case "groq":
      return parseGroqStream(src);
    case "deepseek":
      return parseDeepSeekStream(src);
    case "ollama":
      return parseOllamaStream(src);
    default:
      throw new StreamParseError(`Unknown provider: ${String((opts as { provider: string }).provider)}`);
  }
}

/** Best-effort provider sniff from response headers. */
export function detectProvider(headers: Headers | Record<string, string>): Provider | undefined {
  const get = (k: string) =>
    headers instanceof Headers ? headers.get(k) : headers[k.toLowerCase()];
  const server = (get("server") ?? "").toLowerCase();
  const via = (get("via") ?? "").toLowerCase();
  const ct = (get("content-type") ?? "").toLowerCase();
  if (server.includes("openai") || via.includes("openai")) return "openai";
  if (server.includes("anthropic") || get("anthropic-version")) return "anthropic";
  if (server.includes("google") || ct.includes("vnd.google")) return "gemini";
  if (server.includes("groq") || via.includes("groq")) return "groq";
  if (server.includes("deepseek")) return "deepseek";
  if (server.includes("ollama") || ct.includes("application/x-ndjson")) return "ollama";
  return undefined;
}

export async function collectStream(
  stream: AsyncIterable<StreamChunk>,
): Promise<CollectedMessage> {
  const out: CollectedMessage = {
    text: "",
    reasoning: "",
    toolCalls: [],
    stopReason: null,
    usage: { promptTokens: 0, completionTokens: 0 },
  };
  const tools = new Map<string, { id: string; name: string; arguments: string }>();
  for await (const chunk of stream) {
    if (chunk.type === "text") out.text += chunk.delta;
    else if (chunk.type === "reasoning") out.reasoning += chunk.delta;
    else if (chunk.type === "tool_call") {
      const key = chunk.id || `${chunk.name}:${tools.size}`;
      tools.set(key, { id: chunk.id, name: chunk.name, arguments: chunk.arguments });
    } else if (chunk.type === "done") {
      out.stopReason = chunk.stopReason;
      out.usage = chunk.usage;
    }
  }
  out.toolCalls = [...tools.values()];
  return out;
}

export async function streamToText(stream: AsyncIterable<StreamChunk>): Promise<string> {
  let text = "";
  for await (const chunk of stream) if (chunk.type === "text") text += chunk.delta;
  return text;
}

/** Tee an async iterable into two independent consumers (both must be drained). */
export function teeStream<T>(stream: AsyncIterable<T>): [AsyncIterable<T>, AsyncIterable<T>] {
  const queues: T[][] = [[], []];
  const waiters: Array<((v: IteratorResult<T>) => void) | null> = [null, null];
  let done = false;
  let err: unknown = undefined;

  (async () => {
    try {
      for await (const v of stream) {
        for (let i = 0; i < 2; i++) {
          if (waiters[i]) {
            const w = waiters[i]!;
            waiters[i] = null;
            w({ value: v, done: false });
          } else {
            queues[i]!.push(v);
          }
        }
      }
    } catch (e) {
      err = e;
    } finally {
      done = true;
      for (let i = 0; i < 2; i++) {
        if (waiters[i]) {
          waiters[i]!({ value: undefined as unknown as T, done: true });
          waiters[i] = null;
        }
      }
    }
  })();

  function makeIter(i: 0 | 1): AsyncIterable<T> {
    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<T>> {
            if (queues[i]!.length > 0) {
              return { value: queues[i]!.shift()!, done: false };
            }
            if (done) {
              if (err) throw err;
              return { value: undefined as unknown as T, done: true };
            }
            return new Promise((resolve) => {
              waiters[i] = resolve;
            });
          },
        };
      },
    };
  }

  return [makeIter(0), makeIter(1)];
}
