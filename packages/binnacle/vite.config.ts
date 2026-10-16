import { defineConfig } from 'vite-plus'

const plugins = [
  'transcript',
  'transcript-view',
  'notice',
  'tool-cards',
  'composer',
  'commands',
  'copy',
  'palette',
  'status-line',
  'requests',
  'requests-view',
]

export default defineConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts',
      'testing/index': 'src/testing/index.ts',
      ...Object.fromEntries(plugins.map((plugin) => [`plugins/${plugin}/index`, `src/plugins/${plugin}/index.ts`])),
    },
    dts: { generator: 'tsgo' },
    exports: {
      // The command is the package's bin, not something an author imports.
      exclude: ['cli'],
      customExports: { './cordis.patch.yml': './cordis.patch.yml' },
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
