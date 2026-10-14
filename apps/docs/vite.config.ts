import { defineConfig, lazyPlugins } from 'vite-plus'
import contentCollections from '@content-collections/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [contentCollections(), tailwindcss(), tanstackStart(), viteReact()]),
})
