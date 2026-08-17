import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/pr-scanner.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  preserveEntrySignatures: false,
});
