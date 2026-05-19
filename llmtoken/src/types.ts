export type Provider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "deepseek"
  | "ollama";

export interface TextChunk {
  type: "text";
  delta: string;
  index: number;
}

export interface ToolCallChunk {
  type: "tool_call";
  id: string;
  name: string;
  arguments: string;
  done: boolean;
}

export interface ReasoningChunk {
  type: "reasoning";
  delta: string;
}

export interface ErrorChunk {
  type: "error";
  code: string;
  message: string;
}

export interface DoneChunk {
  type: "done";
  stopReason: string;
  usage: { promptTokens: number; completionTokens: number };
}

export type StreamChunk =
  | TextChunk
  | ToolCallChunk
  | ReasoningChunk
  | ErrorChunk
  | DoneChunk;

export interface CollectedMessage {
  text: string;
  reasoning: string;
  toolCalls: { id: string; name: string; arguments: string }[];
  stopReason: string | null;
  usage: { promptTokens: number; completionTokens: number };
}

export interface ParseStreamOptions {
  provider: Provider;
  /** Override stop reason emitted in the DONE chunk when one cannot be inferred. */
  defaultStopReason?: string;
}

export class StreamParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StreamParseError";
    Object.setPrototypeOf(this, StreamParseError.prototype);
  }
}
