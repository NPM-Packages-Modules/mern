import { type ByteSource, lineIterator } from "../util.js";
import { StreamParseError, type StreamChunk } from "../types.js";

export async function* parseOllamaStream(src: ByteSource): AsyncIterable<StreamChunk> {
  let usage = { promptTokens: 0, completionTokens: 0 };
  let stopReason = "stop";
  try {
    for await (const line of lineIterator(src)) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line) as {
        message?: { content?: string };
        response?: string;
        done?: boolean;
        done_reason?: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const text = obj.message?.content ?? obj.response;
      if (typeof text === "string" && text.length > 0) {
        yield { type: "text", delta: text, index: 0 };
      }
      if (obj.done) {
        if (obj.done_reason) stopReason = obj.done_reason;
        usage = {
          promptTokens: obj.prompt_eval_count ?? 0,
          completionTokens: obj.eval_count ?? 0,
        };
      }
    }
  } catch (err) {
    yield {
      type: "error",
      code: "PARSE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
    throw new StreamParseError("Ollama stream parse error", err);
  }
  yield { type: "done", stopReason, usage };
}
