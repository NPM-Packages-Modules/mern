import { describe, expect, it } from "vitest";
import { parseAnthropicStream } from "../src/providers/anthropic.js";
import { parseGeminiStream } from "../src/providers/gemini.js";
import { parseOllamaStream } from "../src/providers/ollama.js";
import { parseDeepSeekStream } from "../src/providers/deepseek.js";
import { collectStream, streamToText, teeStream, detectProvider } from "../src/index.js";

const enc = new TextEncoder();
async function* source(parts: string[]) {
  for (const p of parts) yield enc.encode(p);
}

describe("Anthropic parser", () => {
  it("parses text + tool_use input_json_delta", async () => {
    const stream = parseAnthropicStream(source([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":5}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"get_time"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"tz\\":\\"UTC\\"}"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}\n\n',
    ]));
    const collected = await collectStream(stream);
    expect(collected.text).toBe("Hi");
    expect(collected.toolCalls).toEqual([{ id: "toolu_1", name: "get_time", arguments: '{"tz":"UTC"}' }]);
    expect(collected.stopReason).toBe("end_turn");
    expect(collected.usage).toEqual({ promptTokens: 5, completionTokens: 2 });
  });
});

describe("Gemini parser", () => {
  it("parses incremental JSON array", async () => {
    const stream = parseGeminiStream(source([
      "[",
      '{"candidates":[{"index":0,"content":{"parts":[{"text":"Hello "}]}}]}',
      ",",
      '{"candidates":[{"index":0,"content":{"parts":[{"text":"world"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":2}}',
      "]",
    ]));
    const c = await collectStream(stream);
    expect(c.text).toBe("Hello world");
    expect(c.stopReason).toBe("STOP");
    expect(c.usage).toEqual({ promptTokens: 4, completionTokens: 2 });
  });
});

describe("Ollama parser", () => {
  it("parses NDJSON", async () => {
    const stream = parseOllamaStream(source([
      '{"message":{"content":"Hello"},"done":false}\n',
      '{"message":{"content":" world"},"done":false}\n',
      '{"done":true,"done_reason":"stop","prompt_eval_count":3,"eval_count":2}\n',
    ]));
    const c = await collectStream(stream);
    expect(c.text).toBe("Hello world");
    expect(c.usage).toEqual({ promptTokens: 3, completionTokens: 2 });
  });
});

describe("DeepSeek parser", () => {
  it("separates reasoning_content from content", async () => {
    const stream = parseDeepSeekStream(source([
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"think"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"answer"}}]}\n\n',
      'data: {"choices":[{"index":0,"finish_reason":"stop","delta":{}}]}\n\n',
      "data: [DONE]\n\n",
    ]));
    const c = await collectStream(stream);
    expect(c.reasoning).toBe("think");
    expect(c.text).toBe("answer");
  });
});

describe("utilities", () => {
  it("teeStream produces two independent iterators", async () => {
    async function* src() {
      yield 1;
      yield 2;
      yield 3;
    }
    const [a, b] = teeStream(src());
    const ra: number[] = [];
    const rb: number[] = [];
    await Promise.all([
      (async () => { for await (const x of a) ra.push(x); })(),
      (async () => { for await (const x of b) rb.push(x); })(),
    ]);
    expect(ra).toEqual([1, 2, 3]);
    expect(rb).toEqual([1, 2, 3]);
  });

  it("detectProvider sniffs headers", () => {
    expect(detectProvider({ server: "openai" })).toBe("openai");
    expect(detectProvider({ "anthropic-version": "2023-06-01" } as Record<string, string>)).toBe("anthropic");
    expect(detectProvider({ "content-type": "application/x-ndjson" })).toBe("ollama");
  });

  it("empty stream yields only done", async () => {
    const stream = parseDeepSeekStream(source(["data: [DONE]\n\n"]));
    expect(await streamToText(stream)).toBe("");
  });
});
