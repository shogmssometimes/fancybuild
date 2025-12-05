import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local-only GM build. Uses its own output directory and relative base so it can
// be opened directly from disk or served locally without affecting the player build.
export default defineConfig({
  base: "./",
  build: {
    outDir: "docs-gm",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        gm: path.resolve(__dirname, "gm.html"),
      },
    },
  },
  plugins: [react()],
});
