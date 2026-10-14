import type { Binnacle, Handle } from '../api.ts'

export interface ScreenOptions {
  /** The Screen's name, the Place it draws, where the Focus starts, and the start of its action's name, `<name>.back`. */
  readonly name: string
  /** Untrusted Text, drawn in the top edge of the Screen's box. */
  readonly title?: string
}

/**
 * Shows a Screen of one Place, `name`, in a box of the theme's edge, with the Focus in it. Fill the Place as any, such as with a List of that name.
 * Esc runs the action `<name>.back`, of the kind `screen.back`, which goes back to the Screen beneath. The Handle's `dispose` goes back too.
 */
export function screen(binnacle: Binnacle, options: ScreenOptions): Handle {
  const { name, title } = options
  const shown = binnacle.show({ name, focus: name, layout: { place: name, border: true, ...(title !== undefined && { title }) } })
  const back = binnacle.action(`${name}.back`, {
    keys: ['escape'],
    place: name,
    kind: 'screen.back',
    description: 'Go back to the Screen beneath',
    run: () => handle.dispose(),
  })
  const handle: Handle = {
    redraw: () => shown.redraw(),
    dispose: () => {
      back.dispose()
      shown.dispose()
    },
  }
  return handle
}
