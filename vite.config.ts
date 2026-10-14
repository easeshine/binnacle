import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    singleQuote: true,
    semi: false,
    sortPackageJson: false,
    ignorePatterns: [
      'pnpm-lock.yaml',
      '**/*.md',
      '.refs/**',
      '**/dist/**',
      // Copied from pi-tui, and kept as close to it as we can.
      'packages/binnacle/src/terminal/pi/**',
      'apps/docs/src/routeTree.gen.ts',
    ],
    printWidth: 140,
  },
  lint: {
    plugins: ['unicorn', 'oxc', 'import', 'node'],
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
      {
        name: 'anti-slop',
        specifier: './tools/oxlint/anti-slop/index.ts',
      },
    ],
    categories: {
      correctness: 'error',
      suspicious: 'error',
    },
    rules: {
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      'oxc/no-accumulating-spread': 'error',
      'anti-slop/no-chained-type-assertions': 'error',
      'anti-slop/no-module-mocking': 'error',
      'anti-slop/no-reduce-accumulator-copy': 'error',
      'anti-slop/no-reflect-apply': 'error',
      'anti-slop/no-reflect-get': 'error',
      'anti-slop/no-widen-then-assert': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        // Copied from pi-tui: its own style stays, so a diff against upstream stays small.
        files: ['packages/binnacle/src/terminal/pi/**'],
        rules: {
          'no-shadow': 'off',
          'no-unmodified-loop-condition': 'off',
          'no-underscore-dangle': 'off',
          'unicorn/no-array-sort': 'off',
          'unicorn/consistent-function-scoping': 'off',
        },
      },
      {
        files: ['packages/binnacle/**'],
        rules: {
          'no-control-regex': 'off',
        },
      },
      {
        files: ['packages/binnacle/src/**'],
        excludeFiles: ['packages/binnacle/src/terminal/pi/**'],
        rules: {
          'max-lines': [
            'error',
            {
              max: 300,
              skipBlankLines: true,
              skipComments: true,
            },
          ],
        },
      },
      {
        files: ['packages/binnacle/src/index.ts'],
        rules: {
          'max-lines': [
            'error',
            {
              max: 80,
              skipBlankLines: true,
              skipComments: true,
            },
          ],
        },
      },
      {
        files: ['packages/binnacle/src/**'],
        excludeFiles: ['packages/binnacle/src/terminal/pi/**'],
        rules: {
          'anti-slop/require-comment-for-type-assertion': 'error',
        },
      },
      {
        files: ['tools/oxlint/anti-slop/index.ts'],
        rules: {
          'import/no-default-export': 'off',
        },
      },
      {
        // content-collections names a doc's `_meta`, and the router a splat's `_splat`.
        files: ['apps/docs/**'],
        rules: {
          'no-underscore-dangle': 'off',
        },
      },
      {
        files: ['**/vite.config.ts', 'commitlint.config.mjs', 'apps/docs/**'],
        rules: {
          'import/no-default-export': 'off',
        },
      },
      {
        // ADR 4: a built-in imports only what an author can, so it proves the API is enough.
        files: ['packages/binnacle/src/plugins/**'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [
                    '*',
                    '!@deepseek-ai/cordis',
                    '!@deepseek-ai/dsh-*',
                    '!@deepseek-ai/dsh-*/**',
                    '!node:*',
                    '!./*',
                    '!../../index.ts',
                    '!../*/index.ts',
                  ],
                  message:
                    "A built-in imports only binnacle's entry, another built-in's entry, cordis, dsh's packages and node's own modules.",
                },
              ],
            },
          ],
        },
      },
    ],
    ignorePatterns: ['.refs/**', '**/dist/**', 'node_modules/**', 'apps/docs/src/routeTree.gen.ts'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  // The root's own tests: the tools and the scripts. Each package runs its own.
  test: {
    include: ['scripts/**/*.test.mjs', 'tools/**/*.test.mjs'],
  },
  run: {
    cache: true,
  },
})
