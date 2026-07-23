import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      env: { VITE_REOWN_PROJECT_ID: 'vitest' },
      environment: 'happy-dom',
      globals: true,
      include: ['src/**/*.{test,spec}.ts'],
      exclude: [
        'p2pix-smart-contracts/**',
        'vendor/**',
        '**/node_modules/**',
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/main.ts',
          'src/router/**',
          'src/assets/**',
          'src/generated.ts',
          'src/subgraph/generated.ts',
          '**/*.d.ts',
          '**/__mocks__/**',
          'p2pix-smart-contracts/**',
          'vendor/**',
        ],
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }),
);
