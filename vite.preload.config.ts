import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [
      "nodejs-polars",
      "nodejs-polars-darwin-arm64",
      "nodejs-polars-darwin-x64",
    ],
  },
  build: {
    rollupOptions: {
      external: ["nodejs-polars", "nodejs-polars-darwin-x64"],
    },
  },
});
