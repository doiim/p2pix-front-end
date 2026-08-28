import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
  const version = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
  ).version as string;
  const tag = sh('git describe --exact-match --tags HEAD');
  if (tag === version) return version;
  const shortSha = sh('git rev-parse --short HEAD');
  return shortSha ? `${version}+${shortSha}` : version;
}

function getReleases(): {
  tag: string;
  title?: string;
  releaseDate: string;
  cid?: string;
  notes?: string;
}[] {
  return sh('git tag --sort=-version:refname')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((tag) => {
      const releaseDate = sh(`git log -1 --format=%cs ${tag}`);
      const cid = sh(`git notes --ref=ipfs show ${tag}`).trim();
      const notes = sh(`git notes show ${tag}`).trim();
      const title = sh(`git for-each-ref --format='%(contents:subject)' refs/tags/${tag}`);
      return {
        tag,
        ...(title ? { title } : {}),
        releaseDate,
        ...(cid ? { cid } : {}),
        ...(notes ? { notes } : {}),
      };
    });
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(getAppVersion()),
    'import.meta.env.APP_RELEASES': JSON.stringify(getReleases()),
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis',
      },
      supported: {
        bigint: true,
      },
    },
    entries: ['index.html', 'src/**/*.{vue,ts,tsx,js,jsx}'],
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
