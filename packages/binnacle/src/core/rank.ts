import { PACKAGE } from './name.ts'

/** One registration. Each is held apart, so that one object registered twice goes only with the plugin whose registration unloads. */
export interface Held<T> {
  readonly item: T
  /** Registered by a row of the bundle: it ranks beneath every author's. */
  readonly builtIn: boolean
}

/** The parts of a Cordis fiber that the core reads. The loader adds `entry`: the row whose plugin it is, or none on a child plugin. */
export interface Fiber {
  /** The plugin's own `name`, with none on a plugin that names none. */
  readonly runtime?: { readonly name?: string }
  readonly entry?: { readonly options: { readonly name: string } }
  readonly parent: { readonly fiber: Fiber }
}

// A child plugin has no row of its own: the row is the first of its parents' that has one, as the loader's `locate` finds it.
export function builtIn(fiber: Fiber): boolean {
  for (let at = fiber; ; at = at.parent.fiber) {
    const name = at.entry?.options.name
    if (name !== undefined) return name === PACKAGE || name.startsWith(`${PACKAGE}/`)
    if (at.parent.fiber === at) return false
  }
}

export function listIn<T>(lists: Map<string, T[]>, name: string): T[] {
  const list = lists.get(name) ?? []
  lists.set(name, list)
  return list
}
