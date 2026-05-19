import type { PromptForge } from "./forge.js";
import { renderTemplate } from "./template.js";

export interface BuiltRequest {
  promptName: string;
  version: number;
  model: string | undefined;
  rendered: string;
  variables: Record<string, unknown>;
}

export async function buildRequest(
  forge: PromptForge,
  promptName: string,
  variables: Record<string, unknown> = {},
  version?: number,
): Promise<BuiltRequest> {
  const prompt = await forge.load(promptName, version);
  return {
    promptName,
    version: prompt.version,
    model: prompt.model,
    rendered: renderTemplate(prompt.template, variables),
    variables,
  };
}

export interface WrapOptions {
  provider: "openai" | "anthropic";
  /** Whether to override the model field on the request with the prompt's model. Default: true if present. */
  applyModel?: boolean;
}

/**
 * Wrap an LLM SDK client so chat-completion / message methods get the active prompt
 * injected automatically when the request body contains `promptName`.
 *
 * Usage:
 *   const wrapped = wrapProvider(openai, forge, { provider: "openai" });
 *   await wrapped.chat.completions.create({ promptName: "summarize", variables: { text } });
 */
export function wrapProvider<T extends object>(
  client: T,
  forge: PromptForge,
  opts: WrapOptions,
): T {
  const handler: ProxyHandler<object> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "object" && value !== null) {
        return new Proxy(value, handler);
      }
      if (typeof value === "function") {
        return async (req: Record<string, unknown> & { promptName?: string; variables?: Record<string, unknown>; version?: number }) => {
          if (req && typeof req === "object" && typeof req.promptName === "string") {
            const built = await buildRequest(forge, req.promptName, req.variables ?? {}, req.version);
            const next: Record<string, unknown> = { ...req };
            delete next.promptName;
            delete next.variables;
            delete next.version;
            if (opts.applyModel !== false && built.model) next.model = built.model;
            if (opts.provider === "openai") {
              next.messages = next.messages ?? [{ role: "user", content: built.rendered }];
              if (Array.isArray(next.messages) && next.messages.length === 0) {
                next.messages = [{ role: "user", content: built.rendered }];
              }
              return (value as Function).call(target, next);
            }
            if (opts.provider === "anthropic") {
              next.messages = next.messages ?? [{ role: "user", content: built.rendered }];
              return (value as Function).call(target, next);
            }
          }
          return (value as Function).call(target, req);
        };
      }
      return value;
    },
  };
  return new Proxy(client, handler) as T;
}
