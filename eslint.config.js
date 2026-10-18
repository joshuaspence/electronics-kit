import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // With noUncheckedIndexedAccess every array read is `T | undefined`; `!` is how numeric code
      // asserts an index it has already bounded.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/ui/**/*.tsx', 'src/main.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Core is framework-independent (CLAUDE.md): no React, no UI, no DOM.
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'core must not depend on React.',
            },
            { group: ['**/ui', '**/ui/*'], message: 'core must not depend on ui.' },
          ],
        },
      ],
    },
  },
  prettier,
);
