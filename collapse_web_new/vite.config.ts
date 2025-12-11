import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Keep a single React instance and make HMR work under the /fancybuild/ base.
const base = process.env.VITE_BASE_PATH || "/fancybuild/";

export default defineConfig({
  base,
  resolve: {
    dedupe: ["react", "react-dom"]
  },
  server: {
    hmr: {
      path: "/hmr" // avoid ws path collisions when serving under /fancybuild/
    }
  },
  build: {
    outDir: "docs",
    emptyOutDir: true,
    rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          gm: path.resolve(__dirname, "gm.html"),
        },
    },
  },
  plugins: [react()]
});
