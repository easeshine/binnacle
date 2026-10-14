import { createServerFn } from '@tanstack/react-start'
import { allDocs } from 'content-collections'
import { sections } from '#/nav'

// On the server only, so a visitor loads the page they read, not every page.
export const getDoc = createServerFn({ method: 'GET' })
  .validator((url: string) => url)
  .handler(({ data: url }) => {
    const doc = allDocs.find((each) => each.url === url)
    return doc === undefined ? undefined : { title: doc.title, html: doc.html }
  })

export const getSections = createServerFn({ method: 'GET' }).handler(() => sections())
