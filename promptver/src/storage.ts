import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { StorageError } from "./errors.js";
import { type PromptDefinition, type Registry, RegistrySchema, PromptDefinitionSchema } from "./types.js";

export interface StorageAdapter {
  loadRegistry(): Promise<Registry>;
  saveRegistry(registry: Registry): Promise<void>;
  loadPrompt(name: string, version: number): Promise<PromptDefinition>;
  savePrompt(prompt: PromptDefinition): Promise<void>;
  listPrompts(): Promise<string[]>;
  listVersions(name: string): Promise<number[]>;
}

const EMPTY_REGISTRY: Registry = { version: 1, prompts: {} };

export interface FileStorageOptions {
  /** Base directory holding prompts (`<dir>/_registry.json` + `<dir>/<name>/<version>.json`). */
  dir?: string;
}

export class FileStorage implements StorageAdapter {
  readonly dir: string;
  private readonly registryFile: string;

  constructor(opts: FileStorageOptions = {}) {
    this.dir = resolve(opts.dir ?? "prompts");
    this.registryFile = join(this.dir, "_registry.json");
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  async loadRegistry(): Promise<Registry> {
    this.ensureDir();
    if (!existsSync(this.registryFile)) {
      return { ...EMPTY_REGISTRY, prompts: {} };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.registryFile, "utf8"));
      return RegistrySchema.parse(parsed);
    } catch (err) {
      throw new StorageError(`Failed to parse registry at ${this.registryFile}`, err);
    }
  }

  async saveRegistry(registry: Registry): Promise<void> {
    this.ensureDir();
    writeFileSync(this.registryFile, JSON.stringify(registry, null, 2) + "\n", "utf8");
  }

  private fileFor(name: string, version: number): string {
    return join(this.dir, name, `${version}.json`);
  }

  async loadPrompt(name: string, version: number): Promise<PromptDefinition> {
    const file = this.fileFor(name, version);
    if (!existsSync(file)) {
      throw new StorageError(`Prompt file not found: ${file}`);
    }
    try {
      return PromptDefinitionSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    } catch (err) {
      throw new StorageError(`Failed to load prompt ${name}@${version}`, err);
    }
  }

  async savePrompt(prompt: PromptDefinition): Promise<void> {
    const dir = join(this.dir, prompt.id);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      this.fileFor(prompt.id, prompt.version),
      JSON.stringify(prompt, null, 2) + "\n",
      "utf8",
    );
  }

  async listPrompts(): Promise<string[]> {
    this.ensureDir();
    return readdirSync(this.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  async listVersions(name: string): Promise<number[]> {
    const dir = join(this.dir, name);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => Number(f.replace(/\.json$/, "")))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }
}

/** In-memory storage useful for tests. */
export class MemoryStorage implements StorageAdapter {
  private registry: Registry = { version: 1, prompts: {} };
  private prompts = new Map<string, PromptDefinition>();

  private key(name: string, version: number) {
    return `${name}@${version}`;
  }

  async loadRegistry() {
    return this.registry;
  }
  async saveRegistry(r: Registry) {
    this.registry = JSON.parse(JSON.stringify(r));
  }
  async loadPrompt(name: string, version: number) {
    const p = this.prompts.get(this.key(name, version));
    if (!p) throw new StorageError(`Prompt not found: ${name}@${version}`);
    return p;
  }
  async savePrompt(p: PromptDefinition) {
    this.prompts.set(this.key(p.id, p.version), p);
  }
  async listPrompts() {
    return Object.keys(this.registry.prompts);
  }
  async listVersions(name: string) {
    return this.registry.prompts[name]?.versions.slice().sort((a, b) => a - b) ?? [];
  }
}
