import { PromptNotFoundError, VersionConflictError } from "./errors.js";
import { FileStorage, type StorageAdapter } from "./storage.js";
import { renderTemplate, extractVariableNames } from "./template.js";
import type { PromptDefinition } from "./types.js";

export interface PromptForgeOptions {
  storage?: StorageAdapter;
}

export class PromptForge {
  readonly storage: StorageAdapter;

  constructor(opts: PromptForgeOptions = {}) {
    this.storage = opts.storage ?? new FileStorage();
  }

  async init(): Promise<void> {
    const registry = await this.storage.loadRegistry();
    await this.storage.saveRegistry(registry);
  }

  async create(
    name: string,
    template: string,
    extras: Partial<Omit<PromptDefinition, "id" | "version" | "template">> = {},
  ): Promise<PromptDefinition> {
    const registry = await this.storage.loadRegistry();
    const entry = registry.prompts[name];
    const nextVersion = entry ? Math.max(...entry.versions) + 1 : 1;
    const prompt: PromptDefinition = {
      id: name,
      version: nextVersion,
      template,
      variables: extras.variables ?? extractVariableNames(template),
      ...(extras.model !== undefined ? { model: extras.model } : {}),
      metadata: extras.metadata ?? {},
    };
    if (entry?.versions.includes(nextVersion)) {
      throw new VersionConflictError(name, nextVersion);
    }
    await this.storage.savePrompt(prompt);
    registry.prompts[name] = {
      name,
      activeVersion: nextVersion,
      versions: [...(entry?.versions ?? []), nextVersion].sort((a, b) => a - b),
    };
    await this.storage.saveRegistry(registry);
    return prompt;
  }

  async load(name: string, version?: number): Promise<PromptDefinition> {
    const registry = await this.storage.loadRegistry();
    const entry = registry.prompts[name];
    if (!entry) throw new PromptNotFoundError(name);
    const v = version ?? entry.activeVersion;
    if (!entry.versions.includes(v)) throw new PromptNotFoundError(name, v);
    return this.storage.loadPrompt(name, v);
  }

  async render(name: string, vars: Record<string, unknown>, version?: number): Promise<string> {
    const prompt = await this.load(name, version);
    return renderTemplate(prompt.template, vars);
  }

  async rollback(name: string, version: number): Promise<void> {
    const registry = await this.storage.loadRegistry();
    const entry = registry.prompts[name];
    if (!entry) throw new PromptNotFoundError(name);
    if (!entry.versions.includes(version)) throw new PromptNotFoundError(name, version);
    entry.activeVersion = version;
    await this.storage.saveRegistry(registry);
  }

  async list(): Promise<{ name: string; activeVersion: number; versions: number[] }[]> {
    const registry = await this.storage.loadRegistry();
    return Object.values(registry.prompts).map((e) => ({
      name: e.name,
      activeVersion: e.activeVersion,
      versions: [...e.versions],
    }));
  }
}
