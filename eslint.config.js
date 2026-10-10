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
        Response: 'readonly',
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
    // The VS Code extension: the same rules, plus what its code can reach.
    files: ['extensions/vscode/**/*.js', 'extensions/vscode/**/*.mjs'],
    languageOptions: {
      globals: {
        globalThis: 'readonly',
        URLSearchParams: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    // The Workflow Wizard's page runs in a browser, inside an editor tab.
    files: ['extensions/vscode/src/webview/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        MutationObserver: 'readonly',
      },
    },
  },
  {
    // test-host/ runs inside VS Code, which loads tests with require() and
    // supplies Mocha's functions.
    files: ['extensions/vscode/test-host/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
      },
    },
  },
  {
    // Ignore files that should not be linted
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'docs-site/**',
      'extensions/vscode/dist/**',
      'extensions/vscode/.vscode-test/**',
    ],
  },
];
