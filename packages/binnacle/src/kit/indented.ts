import type { Framed } from './frame.ts'

/** A Look that draws `look` at its width less `cells`, with that many spaces before each line. A line object keeps its fields, and its `from` moves past the spaces. */
export function indented<D, A extends { readonly width: number }, L extends Framed>(
  look: (data: D, at: A) => readonly L[],
  cells: number,
): (data: D, at: A) => L[] {
  const spaces = ' '.repeat(Math.max(0, Math.floor(cells)))
  return (data, at) =>
    look(data, { ...at, width: Math.max(1, at.width - spaces.length) }).map((line) => {
      // A string line is a string L, as L is a string or an object.
      if (typeof line === 'string') return `${spaces}${line}` as L
      const acting: Exclude<Framed, string> = line
      // The object keeps every field of the line, so it is an L too.
      return { ...acting, text: `${spaces}${acting.text}`, from: spaces.length + (acting.from ?? 0) } as L
    })
}
