import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import svgLoader from "vite-svg-loader";

function getGitTag(): string {
  try {
    const tag = execSync("git describe --tags --abbrev=0").toString().trim();
    return tag || "";
  } catch (error) {
    try {
      const tags = execSync("git tag --sort=-version:refname").toString().trim().split("\n");
      return tags.length > 0 ? tags[0] : "unknown";
    } catch (fallbackError) {
      return "";
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
  },
  define: {
    __APP_VERSION__: JSON.stringify(getGitTag()),
  },
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
  plugins: [vue(), vueJsx(), svgLoader()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "viem/errors": fileURLToPath(
        new URL("./node_modules/viem/errors", import.meta.url)
      ),
    },
  },
});
