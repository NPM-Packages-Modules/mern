import { type ByteSource, sseIterator } from "../util.js";
import { StreamParseError, type StreamChunk } from "../types.js";

interface OpenAIToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

export async function* parseOpenAIStream(src: ByteSource): AsyncIterable<StreamChunk> {
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let usage = { promptTokens: 0, completionTokens: 0 };
  let stopReason = "stop";

  try {
    for await (const ev of sseIterator(src)) {
      if (ev.data === "[DONE]") break;
      if (!ev.data) continue;
      const parsed = JSON.parse(ev.data) as {
        choices?: Array<{
          index?: number;
          delta?: {
            content?: string | null;
            reasoning?: string | null;
            reasoning_content?: string | null;
            tool_calls?: OpenAIToolCallDelta[];
          };
          finish_reason?: string | null;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      if (parsed.usage) {
        usage = {
          promptTokens: parsed.usage.prompt_tokens ?? 0,
          completionTokens: parsed.usage.completion_tokens ?? 0,
        };
      }

      for (const choice of parsed.choices ?? []) {
        const idx = choice.index ?? 0;
        const delta = choice.delta ?? {};
        if (typeof delta.content === "string" && delta.content.length > 0) {
          yield { type: "text", delta: delta.content, index: idx };
        }
        const reasoning = delta.reasoning ?? delta.reasoning_content;
        if (typeof reasoning === "string" && reasoning.length > 0) {
          yield { type: "reasoning", delta: reasoning };
        }
        for (const tc of delta.tool_calls ?? []) {
          const slot = toolCalls.get(tc.index) ?? { id: "", name: "", arguments: "" };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.arguments += tc.function.arguments;
          toolCalls.set(tc.index, slot);
          yield {
            type: "tool_call",
            id: slot.id,
            name: slot.name,
            arguments: slot.arguments,
            done: false,
          };
        }
        if (choice.finish_reason) {
          stopReason = choice.finish_reason;
          for (const slot of toolCalls.values()) {
            yield { type: "tool_call", id: slot.id, name: slot.name, arguments: slot.arguments, done: true };
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
    throw new StreamParseError("OpenAI stream parse error", err);
  }

  yield { type: "done", stopReason, usage };
}
