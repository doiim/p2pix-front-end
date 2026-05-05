import pluginVue from 'eslint-plugin-vue';
import vueTsConfig from '@vue/eslint-config-typescript';
import vuePrettierConfig from '@vue/eslint-config-prettier';

const sources = ['src/**/*.{ts,tsx,vue,js,mjs,cjs}', 'tests/**/*.{ts,tsx,vue,js,mjs,cjs}'];

export default [
  { ignores: ['src/generated.ts'] },
  ...pluginVue.configs['flat/essential'].map((c) => ({ ...c, files: sources })),
  ...vueTsConfig().map((c) => ({ ...c, files: sources })),
  { ...vuePrettierConfig, files: sources },
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
];
