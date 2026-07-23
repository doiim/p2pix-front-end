import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import vuePrettierConfig from '@vue/eslint-config-prettier';

const sources = ['src/**/*.{ts,tsx,vue,js,mjs,cjs}', 'tests/**/*.{ts,tsx,vue,js,mjs,cjs}'];

export default defineConfigWithVueTs(
  {
    ignores: [
      'src/generated.ts',
      'src/blockchain/abi.ts',
      'dist/**',
      'node_modules/**',
    ],
  },
  {
    files: sources,
    extends: [pluginVue.configs['flat/essential'], vueTsConfigs.recommended],
  },
  {
    files: sources,
    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
      'prettier/prettier': ['error', { singleQuote: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  { ...vuePrettierConfig, files: sources },
);
