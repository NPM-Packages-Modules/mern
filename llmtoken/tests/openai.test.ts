import { describe, expect, it } from "vitest";
import { parseOpenAIStream } from "../src/providers/openai.js";
import { collectStream, streamToText } from "../src/index.js";

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
async function* source(chunks: string[]): AsyncIterable<Uint8Array> {
  for (const c of chunks) yield bytes(c);
}

describe("OpenAI parser", () => {
  it("parses text deltas and DONE marker", async () => {
    const stream = parseOpenAIStream(source([
      'data: {"choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":" World"}}]}\n\n',
      'data: {"choices":[{"index":0,"finish_reason":"stop","delta":{}}]}\n\n',
      "data: [DONE]\n\n",
    ]));
    expect(await streamToText(stream)).toBe("Hello World");
  });

  it("merges multi-chunk tool calls and emits a final done flag", async () => {
    const stream = parseOpenAIStream(source([
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_weather","arguments":"{\\"loc"}}]}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"SF\\"}"}}]}}]}\n\n',
      'data: {"choices":[{"index":0,"finish_reason":"tool_calls","delta":{}}]}\n\n',
      "data: [DONE]\n\n",
    ]));
    const collected = await collectStream(stream);
    expect(collected.toolCalls).toHaveLength(1);
    expect(collected.toolCalls[0]!.name).toBe("get_weather");
    expect(collected.toolCalls[0]!.arguments).toBe('{"loc":"SF"}');
    expect(collected.stopReason).toBe("tool_calls");
  });

  it("emits reasoning tokens for o1-style streams", async () => {
    const stream = parseOpenAIStream(source([
      'data: {"choices":[{"index":0,"delta":{"reasoning":"thinking step 1"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"answer"}}]}\n\n',
      'data: {"choices":[{"index":0,"finish_reason":"stop","delta":{}}]}\n\n',
      "data: [DONE]\n\n",
    ]));
    const c = await collectStream(stream);
    expect(c.reasoning).toBe("thinking step 1");
    expect(c.text).toBe("answer");
  });

  it("captures usage tokens", async () => {
    const stream = parseOpenAIStream(source([
      'data: {"choices":[{"index":0,"delta":{"content":"hi"}}],"usage":{"prompt_tokens":10,"completion_tokens":1}}\n\n',
      'data: {"choices":[{"index":0,"finish_reason":"stop","delta":{}}]}\n\n',
      "data: [DONE]\n\n",
    ]));
    const c = await collectStream(stream);
    expect(c.usage).toEqual({ promptTokens: 10, completionTokens: 1 });
  });
});
