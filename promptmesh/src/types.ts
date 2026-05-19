export type Role = "system" | "user" | "assistant";

export interface PromptMessage {
  role: Role;
  content: string;
}

export interface PromptVersion {
  name: string;
  version: string;
  messages: PromptMessage[];
  variables: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RenderInput {
  variables?: Record<string, string | number | boolean>;
  version?: string;
  variant?: string;
  tags?: string[];
}

export interface RenderedPrompt {
  name: string;
  version: string;
  variant?: string;
  messages: PromptMessage[];
  hash: string;
  meta: Record<string, unknown>;
}

export interface Variant {
  name: string;
  weight: number;
  version: string;
}

export interface ExperimentConfig {
  variants: Variant[];
  hashKey?: string;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  storedAt: number;
  expiresAt?: number;
  hits: number;
}

export interface CacheStore<T> {
  get(key: string): CacheEntry<T> | undefined;
  set(key: string, value: T, ttlMs?: number): CacheEntry<T>;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
}

export type Provider<TResponse = string> = (
  prompt: RenderedPrompt,
  context: { variables: Record<string, unknown> },
) => Promise<TResponse>;

export interface RunOptions<TResponse> {
  variables?: Record<string, string | number | boolean>;
  cacheTtlMs?: number;
  cacheKey?: string;
  bypassCache?: boolean;
  provider?: Provider<TResponse>;
  fallbacks?: Array<Provider<TResponse>>;
  tags?: string[];
}

export interface RunRecord<TResponse> {
  prompt: RenderedPrompt;
  cached: boolean;
  response: TResponse;
  attempts: number;
  durationMs: number;
  errors?: string[];
}

export interface MeshAnalytics {
  totalCalls: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  byVariant: Record<string, { calls: number; latencyMsSum: number; avgLatencyMs: number }>;
}
