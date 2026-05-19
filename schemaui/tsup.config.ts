import { defineConfig } from "tsup";
export default defineConfig({
  entry: { index: "src/index.tsx" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  esbuildOptions(o) {
    o.jsx = "automatic";
  },
});
