import pluginVue from 'eslint-plugin-vue';
import vueTsConfig from '@vue/eslint-config-typescript';
import vuePrettierConfig from '@vue/eslint-config-prettier';

export default [
  {
    ignores: [
      '**',
      '!src/**',
      '!tests/**',
      'src/generated.ts',
    ],
  },
  ...pluginVue.configs['flat/essential'],
  ...vueTsConfig(),

  // 1. Mantemos a config base do Prettier
  vuePrettierConfig,

  {
    rules: {
      // 2. Forçamos o ESLint a exigir aspas simples
      quotes: ['error', 'single', { avoidEscape: true }],

      // 3. IMPORTANTÍSSIMO: Forçamos o PRETTIER a também usar aspas simples
      // Isso evita que um atropele o outro
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
