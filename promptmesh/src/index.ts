export { PromptMesh, type MeshOptions } from "./mesh.js";
export { PromptRegistry, type PromptRegistration } from "./registry.js";
export { MemoryCache } from "./cache.js";
export { pickVariant } from "./experiment.js";
export { extractVariables, renderTemplate } from "./template.js";
export { hashPrompt, stableHash } from "./hash.js";
export type {
  PromptMessage,
  PromptVersion,
  Role,
  RenderInput,
  RenderedPrompt,
  Variant,
  ExperimentConfig,
  CacheEntry,
  CacheStore,
  Provider,
  RunOptions,
  RunRecord,
  MeshAnalytics,
} from "./types.js";

import { PromptMesh } from "./mesh.js";

export function createMesh<TResponse = string>(
  options?: ConstructorParameters<typeof PromptMesh<TResponse>>[0],
): PromptMesh<TResponse> {
  return new PromptMesh<TResponse>(options);
}
