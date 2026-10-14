import { createFileRoute } from '@tanstack/react-router'
import { sections } from '#/nav'

// The index of the docs, for an agent: https://llmstxt.org
export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin
        const body = [
          '# binnacle',
          '',
          '> A terminal app for DeepSeek Harness (dsh). Everything it draws and answers is a plugin that an author can change. The same docs come with the package @easeshine/binnacle, in its docs/ folder.',
          '',
          `Every page in one file: ${origin}/llms-full.txt`,
          ...sections().flatMap((section) => [
            '',
            `## ${section.title}`,
            '',
            ...section.docs.map((doc) => `- [${doc.title}](${origin}${doc.url})`),
          ]),
          '',
        ].join('\n')
        return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      },
    },
  },
})
