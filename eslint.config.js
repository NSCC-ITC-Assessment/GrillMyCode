import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier, // disables ESLint formatting rules that conflict with Prettier
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        fetch: 'readonly',
        atob: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // core.info() is preferred but console is used in tests
      'no-process-exit': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-throw-literal': 'error',
      'no-return-await': 'error',
    },
  },
  {
    // Ignore files that should not be linted
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'docs-site/**'],
  },
];
