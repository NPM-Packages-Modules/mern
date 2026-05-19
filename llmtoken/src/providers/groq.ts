import type { ByteSource } from "../util.js";
import type { StreamChunk } from "../types.js";
import { parseOpenAIStream } from "./openai.js";

/** Groq uses OpenAI-compatible SSE; only finish_reason vocabulary differs. */
export async function* parseGroqStream(src: ByteSource): AsyncIterable<StreamChunk> {
  for await (const chunk of parseOpenAIStream(src)) {
    if (chunk.type === "done") {
      const mapped: Record<string, string> = {
        stop: "stop",
        length: "length",
        tool_calls: "tool_calls",
        function_call: "tool_calls",
        content_filter: "content_filter",
      };
      yield { ...chunk, stopReason: mapped[chunk.stopReason] ?? chunk.stopReason };
    } else {
      yield chunk;
    }
  }
}
