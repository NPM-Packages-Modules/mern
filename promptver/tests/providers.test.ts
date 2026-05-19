import { describe, expect, it, vi } from "vitest";
import { PromptForge, MemoryStorage, wrapProvider, buildRequest } from "../src/index.js";

describe("wrapProvider", () => {
  it("injects rendered prompt into OpenAI-style requests", async () => {
    const forge = new PromptForge({ storage: new MemoryStorage() });
    await forge.create("hi", "Hello {{name}}!", { model: "gpt-4o-mini" });

    const create = vi.fn(async (req: unknown) => ({ ok: true, req }));
    const client = { chat: { completions: { create } } };
    const wrapped = wrapProvider(client, forge, { provider: "openai" });
    await wrapped.chat.completions.create({ promptName: "hi", variables: { name: "Ada" } } as any);

    expect(create).toHaveBeenCalledOnce();
    const req = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(req.model).toBe("gpt-4o-mini");
    expect(req.messages).toEqual([{ role: "user", content: "Hello Ada!" }]);
    expect((req as Record<string, unknown>).promptName).toBeUndefined();
  });

  it("passes through non-prompt requests unchanged", async () => {
    const forge = new PromptForge({ storage: new MemoryStorage() });
    const create = vi.fn(async (req: unknown) => req);
    const client = { chat: { completions: { create } } };
    const wrapped = wrapProvider(client, forge, { provider: "openai" });
    await wrapped.chat.completions.create({ model: "x", messages: [{ role: "user", content: "raw" }] } as any);
    expect(create).toHaveBeenCalledWith({ model: "x", messages: [{ role: "user", content: "raw" }] });
  });

  it("buildRequest returns rendered template", async () => {
    const forge = new PromptForge({ storage: new MemoryStorage() });
    await forge.create("p", "Sum: {{x}} + {{y}}");
    const built = await buildRequest(forge, "p", { x: 1, y: 2 });
    expect(built.rendered).toBe("Sum: 1 + 2");
  });
});
