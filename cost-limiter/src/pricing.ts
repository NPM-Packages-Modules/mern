export interface ModelPrice {
  /** Dollar cost per 1,000,000 input tokens. */
  inputPerMTokens: number;
  /** Dollar cost per 1,000,000 output tokens. */
  outputPerMTokens: number;
}

export const DEFAULT_PRICING: Record<string, ModelPrice> = {
  // OpenAI
  "gpt-4o": { inputPerMTokens: 2.50, outputPerMTokens: 10.00 },
  "gpt-4o-mini": { inputPerMTokens: 0.15, outputPerMTokens: 0.60 },
  "gpt-4-turbo": { inputPerMTokens: 10.00, outputPerMTokens: 30.00 },
  "gpt-3.5-turbo": { inputPerMTokens: 0.50, outputPerMTokens: 1.50 },
  "o1": { inputPerMTokens: 15.00, outputPerMTokens: 60.00 },
  "o1-mini": { inputPerMTokens: 3.00, outputPerMTokens: 12.00 },
  "o3-mini": { inputPerMTokens: 1.10, outputPerMTokens: 4.40 },
  // Anthropic
  "claude-opus-4": { inputPerMTokens: 15.00, outputPerMTokens: 75.00 },
  "claude-sonnet-4": { inputPerMTokens: 3.00, outputPerMTokens: 15.00 },
  "claude-haiku-4": { inputPerMTokens: 1.00, outputPerMTokens: 5.00 },
  // Gemini
  "gemini-2.0-flash": { inputPerMTokens: 0.10, outputPerMTokens: 0.40 },
  "gemini-1.5-pro": { inputPerMTokens: 1.25, outputPerMTokens: 5.00 },
  "gemini-1.5-flash": { inputPerMTokens: 0.075, outputPerMTokens: 0.30 },
  // Groq
  "llama-3.3-70b": { inputPerMTokens: 0.59, outputPerMTokens: 0.79 },
  "mixtral-8x7b": { inputPerMTokens: 0.24, outputPerMTokens: 0.24 },
};

export interface PricingConfig {
  pricing?: Record<string, ModelPrice>;
}

export function priceCall(model: string, inputTokens: number, outputTokens: number, custom: Record<string, ModelPrice> = {}): number {
  const p = custom[model] ?? DEFAULT_PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.inputPerMTokens + outputTokens * p.outputPerMTokens) / 1_000_000;
}
