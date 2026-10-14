import { allDocs } from 'content-collections'

export interface Section {
  title: string
  docs: { title: string; url: string }[]
}

// The order a reader meets them: a person's pages, then an author's from the start to the built-ins.
const SECTIONS: [prefix: string, title: string][] = [
  ['use/', 'Using binnacle'],
  ['author/concepts/', 'Concepts'],
  ['author/components/', 'Components'],
  ['author/built-ins/', 'Built-ins'],
  ['author/', 'Changing binnacle'],
  ['', 'Reference'],
]

// A folder's index has the folder's path, such as `use` for `use/index.md`, so a path is matched with a slash after it.
const keyOf = (path: string) => `${path}/`

export function sections(): Section[] {
  const taken = new Set<string>()
  const made = SECTIONS.map(([prefix, title]) => {
    const docs = allDocs
      .filter((doc) => keyOf(doc.path).startsWith(prefix) && !taken.has(doc.path))
      .toSorted((a, b) => Number(keyOf(a.path) !== prefix) - Number(keyOf(b.path) !== prefix) || a.path.localeCompare(b.path))
    docs.forEach((doc) => taken.add(doc.path))
    return { title, docs: docs.map((doc) => ({ title: doc.title, url: doc.url })) }
  })
  // An author reads the start before the concepts.
  const order = ['Using binnacle', 'Changing binnacle', 'Concepts', 'Components', 'Built-ins', 'Reference']
  return order.map((title) => made.find((section) => section.title === title)!).filter((section) => section.docs.length > 0)
}
