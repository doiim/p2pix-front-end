import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import svgLoader from "vite-svg-loader";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      define: {
        global: "globalThis",
      },
      supported: {
        bigint: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "c8",
      all: true,
      src: ["./src"],
      exclude: ["model/**", "**/__tests__/**"],
      reporter: ["text", "lcov", "html"],
    },
  },
  plugins: [vue(), vueJsx(), svgLoader()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
