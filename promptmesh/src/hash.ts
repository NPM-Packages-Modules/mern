import { createHash } from "node:crypto";
import type { PromptMessage } from "./types.js";

export function hashPrompt(
  name: string,
  version: string,
  messages: PromptMessage[],
  variables: Record<string, unknown>,
): string {
  const sortedVars = Object.keys(variables)
    .sort()
    .map((k) => `${k}=${JSON.stringify(variables[k])}`)
    .join("|");
  const body = JSON.stringify({ name, version, messages });
  return createHash("sha1").update(`${body}::${sortedVars}`).digest("hex").slice(0, 16);
}

export function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
