import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "providers/openai": "src/providers/openai.ts",
    "providers/anthropic": "src/providers/anthropic.ts",
    "providers/gemini": "src/providers/gemini.ts",
    "providers/groq": "src/providers/groq.ts",
    "providers/deepseek": "src/providers/deepseek.ts",
    "providers/ollama": "src/providers/ollama.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  target: ["node18", "es2022"],
  minify: true,
});
