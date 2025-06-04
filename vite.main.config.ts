import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  build: {
    rollupOptions: {
      external: [
        "nodejs-polars",
        "nodejs-polars-darwin-x64",
        "nodejs-polars-darwin-arm64",
        "nodejs-polars-win32-x64-msvc",
        "nodejs-polars-linux-x64-gnu",
        "nodejs-polars-linux-arm64-gnu",
        "nodejs-polars-linux-x64-musl",
        "nodejs-polars-linux-arm64-musl",
        "nodejs-polars-android-arm64",
        "electron",
      ],
    },
    minify: false,
  },
});
