import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    ssr: resolve(__dirname, "src/index.ts"),
    outDir: "dist",
    target: "node20",
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
  ssr: {
    external: ["discord.js", "@napi-rs/canvas"],
  },
});
