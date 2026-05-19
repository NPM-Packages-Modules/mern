import { type ByteSource, sseIterator } from "../util.js";
import { StreamParseError, type StreamChunk } from "../types.js";

export async function* parseAnthropicStream(src: ByteSource): AsyncIterable<StreamChunk> {
  let stopReason = "end_turn";
  const usage = { promptTokens: 0, completionTokens: 0 };
  const toolByIndex = new Map<number, { id: string; name: string; arguments: string }>();

  try {
    for await (const ev of sseIterator(src)) {
      if (!ev.data) continue;
      const data = JSON.parse(ev.data) as Record<string, unknown>;
      const evt = (ev.event ?? data.type) as string | undefined;

      if (evt === "message_start") {
        const msg = (data.message ?? {}) as { usage?: { input_tokens?: number } };
        usage.promptTokens = msg.usage?.input_tokens ?? 0;
      } else if (evt === "content_block_start") {
        const block = (data.content_block ?? {}) as { type?: string; id?: string; name?: string };
        if (block.type === "tool_use") {
          const index = (data.index as number) ?? 0;
          toolByIndex.set(index, { id: block.id ?? "", name: block.name ?? "", arguments: "" });
        }
      } else if (evt === "content_block_delta") {
        const delta = (data.delta ?? {}) as { type?: string; text?: string; partial_json?: string; thinking?: string };
        const index = (data.index as number) ?? 0;
        if (delta.type === "text_delta" && typeof delta.text === "string") {
          yield { type: "text", delta: delta.text, index };
        } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
          yield { type: "reasoning", delta: delta.thinking };
        } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
          const slot = toolByIndex.get(index);
          if (slot) {
            slot.arguments += delta.partial_json;
            yield { type: "tool_call", id: slot.id, name: slot.name, arguments: slot.arguments, done: false };
          }
        }
      } else if (evt === "content_block_stop") {
        const index = (data.index as number) ?? 0;
        const slot = toolByIndex.get(index);
        if (slot) {
          yield { type: "tool_call", id: slot.id, name: slot.name, arguments: slot.arguments, done: true };
        }
      } else if (evt === "message_delta") {
        const delta = (data.delta ?? {}) as { stop_reason?: string };
        const u = (data.usage ?? {}) as { output_tokens?: number };
        if (delta.stop_reason) stopReason = delta.stop_reason;
        if (typeof u.output_tokens === "number") usage.completionTokens = u.output_tokens;
      } else if (evt === "error") {
        const err = (data.error ?? {}) as { type?: string; message?: string };
        yield { type: "error", code: err.type ?? "anthropic_error", message: err.message ?? "stream error" };
      }
    }
  } catch (err) {
    yield {
      type: "error",
      code: "PARSE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
    throw new StreamParseError("Anthropic stream parse error", err);
  }

  yield { type: "done", stopReason, usage };
}
