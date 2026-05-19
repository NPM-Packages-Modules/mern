import { extractVariables } from "./template.js";
import type { ExperimentConfig, PromptMessage, PromptVersion } from "./types.js";

export interface PromptRegistration {
  name: string;
  version: string;
  messages: PromptMessage[];
  metadata?: Record<string, unknown>;
}

export class PromptRegistry {
  private prompts = new Map<string, PromptVersion[]>();
  private experiments = new Map<string, ExperimentConfig>();

  register(reg: PromptRegistration): PromptVersion {
    const allText = reg.messages.map((m) => m.content).join("\n");
    const version: PromptVersion = {
      name: reg.name,
      version: reg.version,
      messages: reg.messages,
      variables: extractVariables(allText),
      metadata: reg.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    const list = this.prompts.get(reg.name) ?? [];
    if (list.find((v) => v.version === reg.version)) {
      throw new Error(`Prompt ${reg.name}@${reg.version} already registered`);
    }
    list.push(version);
    this.prompts.set(reg.name, list);
    return version;
  }

  setExperiment(name: string, config: ExperimentConfig): void {
    if (config.variants.length === 0) {
      throw new Error(`Experiment ${name} requires at least one variant`);
    }
    this.experiments.set(name, config);
  }

  experiment(name: string): ExperimentConfig | undefined {
    return this.experiments.get(name);
  }

  get(name: string, version?: string): PromptVersion {
    const list = this.prompts.get(name);
    if (!list || list.length === 0) {
      throw new Error(`Prompt ${name} not registered`);
    }
    if (!version) return list[list.length - 1]!;
    const found = list.find((v) => v.version === version);
    if (!found) {
      throw new Error(`Prompt ${name}@${version} not found`);
    }
    return found;
  }

  versions(name: string): string[] {
    const list = this.prompts.get(name) ?? [];
    return list.map((v) => v.version);
  }

  list(): string[] {
    return Array.from(this.prompts.keys());
  }
}
