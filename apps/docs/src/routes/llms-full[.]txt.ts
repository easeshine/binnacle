import { createFileRoute } from '@tanstack/react-router'
import { allDocs } from 'content-collections'
import { sections } from '#/nav'

// Every page of the docs as markdown, in the order of the index, for an agent that reads them all at once.
export const Route = createFileRoute('/llms-full.txt')({
  server: {
    handlers: {
      GET: () => {
        const urls = sections().flatMap((section) => section.docs.map((doc) => doc.url))
        const body = urls.map((url) => allDocs.find((doc) => doc.url === url)!.content.trim()).join('\n\n---\n\n')
        return new Response(`${body}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      },
    },
  },
})
