import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import tailwindcss from '@tailwindcss/vite';
import svgLoader from 'vite-svg-loader';

function sh(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function getAppVersion(): string {
  const tag = sh('git tag --sort=-version:refname').split('\n')[0] || '';
  const shortSha = sh('git rev-parse --short HEAD');
  const tagSha = tag ? sh(`git rev-list -n 1 ${tag}`) : '';
  const headSha = sh('git rev-parse HEAD');
  if (tag && tagSha === headSha) return tag;
  if (tag && shortSha) return `${tag}+${shortSha}`;
  return shortSha || 'dev';
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
  },
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
  optimizeDeps: {
    include: ['@doiim/reown-appkit/vue', '@doiim/reown-appkit-adapter-wagmi'],
    entries: ['index.html', 'src/**/*.{vue,ts,tsx,js,jsx}'],
  },
  server: {
    watch: {
      ignored: ['**/vendor/**'],
    },
  },
  plugins: [vue(), vueJsx(), tailwindcss(), svgLoader()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'viem/errors': fileURLToPath(
        new URL('./node_modules/viem/errors', import.meta.url),
      ),
    },
  },
});
