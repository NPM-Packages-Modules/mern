import { type ByteSource, toByteIterator } from "../util.js";
import { StreamParseError, type StreamChunk } from "../types.js";

interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: unknown };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
    index?: number;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Gemini streams a JSON array. We accept either:
 *   - SSE-style `data: { ... }` lines
 *   - a raw JSON array streamed as bytes (parse incrementally on `}` boundaries at depth 1).
 */
export async function* parseGeminiStream(src: ByteSource): AsyncIterable<StreamChunk> {
  let usage = { promptTokens: 0, completionTokens: 0 };
  let stopReason = "STOP";
  let toolId = 0;

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  try {
    for await (const bytes of toByteIterator(src)) {
      buffer += decoder.decode(bytes, { stream: true });
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i]!;
        if (inString) {
          if (escape) escape = false;
          else if (ch === "\\") escape = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === "{") {
          if (depth === 0) start = i;
          depth += 1;
        } else if (ch === "}") {
          depth -= 1;
          if (depth === 0 && start >= 0) {
            const piece = buffer.slice(start, i + 1);
            try {
              const obj = JSON.parse(piece) as GeminiResponse;
              for (const ch of emitGemini(obj, () => `gem_${++toolId}`)) {
                yield ch;
              }
              if (obj.usageMetadata) {
                usage = {
                  promptTokens: obj.usageMetadata.promptTokenCount ?? usage.promptTokens,
                  completionTokens: obj.usageMetadata.candidatesTokenCount ?? usage.completionTokens,
                };
              }
              const fr = obj.candidates?.[0]?.finishReason;
              if (fr) stopReason = fr;
            } catch {
              // Skip non-object array elements
            }
            buffer = buffer.slice(i + 1);
            i = -1;
            start = -1;
          }
        }
      }
    }
  } catch (err) {
    yield {
      type: "error",
      code: "PARSE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
    throw new StreamParseError("Gemini stream parse error", err);
  }

  yield { type: "done", stopReason, usage };
}

function* emitGemini(
  obj: GeminiResponse,
  nextId: () => string,
): Generator<StreamChunk> {
  for (const cand of obj.candidates ?? []) {
    const idx = cand.index ?? 0;
    for (const part of cand.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.length > 0) {
        yield { type: "text", delta: part.text, index: idx };
      }
      if (part.functionCall) {
        const id = nextId();
        yield {
          type: "tool_call",
          id,
          name: part.functionCall.name ?? "",
          arguments: JSON.stringify(part.functionCall.args ?? {}),
          done: true,
        };
      }
    }
  }
}
