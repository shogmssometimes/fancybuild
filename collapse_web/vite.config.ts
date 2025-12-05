import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Serve under this repo's Pages path.
  base: "/fancybuild/",
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
