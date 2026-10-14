import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMarkdown } from '@content-collections/markdown'
import { posix } from 'node:path'
import { z } from 'zod'

// The one copy of the docs: the package carries this folder, and the site shows it.
const DOCS = '../../packages/binnacle/docs'

/** The site's URL of a doc, by its path in the folder: `use/index` is `/docs/use`. */
export function urlOf(path: string): string {
  return `/docs/${path.replace(/(^|\/)index$/, '')}`.replace(/\/$/, '')
}

interface Node {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: Node[]
}

// A link from one doc to another names the other's file, so that it works in the package. On the site, it goes to the other's URL.
function linksOf(path: string) {
  return () => (tree: Node) => {
    const walk = (node: Node) => {
      const href = node.properties?.href
      if (node.tagName === 'a' && typeof href === 'string' && !/^[a-z]+:|^#/.test(href)) {
        const [file = '', anchor] = href.split('#')
        if (file.endsWith('.md')) {
          const url = urlOf(posix.join(posix.dirname(path), file).replace(/\.md$/, ''))
          node.properties!.href = anchor === undefined ? url : `${url}#${anchor}`
        }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

// A heading's id is GitHub's, so that a link's anchor finds it on the site as in the package.
function headingIds() {
  return () => (tree: Node) => {
    const text = (node: Node): string => (node as { value?: string }).value ?? (node.children ?? []).map(text).join('')
    const walk = (node: Node) => {
      if (node.tagName !== undefined && /^h[1-6]$/.test(node.tagName)) {
        node.properties = {
          ...node.properties,
          id: text(node)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/ /g, '-'),
        }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

const docs = defineCollection({
  name: 'docs',
  directory: DOCS,
  include: '**/*.md',
  schema: z.object({ content: z.string() }),
  transform: async (doc, context) => {
    const title = /^# (.+)$/m.exec(doc.content)?.[1] ?? doc._meta.path
    const html = await compileMarkdown(context, doc, { rehypePlugins: [linksOf(doc._meta.path), headingIds()] })
    return { path: doc._meta.path, url: urlOf(doc._meta.path), title: title.replace(/`/g, ''), content: doc.content, html }
  },
})

export default defineConfig({ content: [docs] })
