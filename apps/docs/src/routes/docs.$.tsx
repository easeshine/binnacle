import { createFileRoute, notFound } from '@tanstack/react-router'
import { getDoc } from '#/docs'

export const Route = createFileRoute('/docs/$')({
  loader: async ({ params }) => {
    const doc = await getDoc({ data: `/docs/${params._splat ?? ''}`.replace(/\/$/, '') })
    if (doc === undefined) throw notFound()
    return doc
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title} · binnacle` }] }),
  component: Doc,
})

function Doc() {
  const { html } = Route.useLoaderData()
  // The html is compiled from the docs folder at build time, not from what a visitor sends.
  return <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
