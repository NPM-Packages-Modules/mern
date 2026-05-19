import { z } from "zod";

export const PromptDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  template: z.string().min(1),
  variables: z.array(z.string()).default([]),
  model: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;

export const RegistryEntrySchema = z.object({
  name: z.string(),
  activeVersion: z.number().int().nonnegative(),
  versions: z.array(z.number().int().nonnegative()),
});
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

export const RegistrySchema = z.object({
  version: z.literal(1),
  prompts: z.record(RegistryEntrySchema),
});
export type Registry = z.infer<typeof RegistrySchema>;

export interface ExperimentVariant {
  readonly name: string;
  readonly promptName: string;
  readonly version?: number;
  readonly weight: number;
  readonly model?: string;
}

export interface ExperimentConfig {
  readonly id: string;
  readonly variants: readonly ExperimentVariant[];
}

export interface ExperimentRecord {
  variantName: string;
  callCount: number;
  totalLatencyMs: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  customMetrics: Record<string, number>;
}

export interface ExperimentResult {
  experimentId: string;
  totalCalls: number;
  byVariant: Record<string, ExperimentRecord>;
}

export type WinnerMetric = "cost" | "latency" | string;

export interface CallRecord {
  variantName: string;
  latencyMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  custom?: Record<string, number>;
}
