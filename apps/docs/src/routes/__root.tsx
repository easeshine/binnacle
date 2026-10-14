import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { getSections } from '#/docs'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'binnacle' }],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: () => getSections(),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const sections = Route.useLoaderData()
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-white text-neutral-900">
        <div className="mx-auto flex max-w-6xl gap-10 px-6 py-8">
          <nav className="w-56 shrink-0 text-sm">
            <Link to="/" className="mb-6 block text-lg font-semibold">
              binnacle
            </Link>
            {sections.map((section) => (
              <div key={section.title} className="mb-5">
                <div className="mb-1 font-medium text-neutral-500">{section.title}</div>
                <ul>
                  {section.docs.map((doc) => (
                    <li key={doc.url}>
                      <a href={doc.url} className="block py-0.5 hover:underline">
                        {doc.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
