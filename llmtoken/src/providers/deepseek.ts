import type { ByteSource } from "../util.js";
import type { StreamChunk } from "../types.js";
import { parseOpenAIStream } from "./openai.js";

/** DeepSeek is OpenAI-compatible; the OpenAI parser already maps `reasoning_content` → reasoning chunks. */
export const parseDeepSeekStream = (src: ByteSource): AsyncIterable<StreamChunk> =>
  parseOpenAIStream(src);
