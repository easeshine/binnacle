import type { Part } from '../api.ts'
import { isKeyRelease } from '../terminal/pi/keys.ts'
import type { StdinBuffer } from '../terminal/pi/stdin-buffer.ts'
import type { Pointer } from './actions.ts'

const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

const SGR_MOUSE = /^\x1b\[<(?<button>\d+);(?<x>\d+);(?<y>\d+)(?<press>[Mm])$/
// The SGR report's modifier bits: 4 shift, 8 alt, 16 ctrl.
const MODIFIER_BITS: readonly (readonly [number, string])[] = [
  [4, 'shift'],
  [8, 'alt'],
  [16, 'ctrl'],
]
const MODIFIERS = 4 | 8 | 16
// The button identities the core takes: the left button, held while it moves, let go, and the wheel's two directions.
// A terminal can report a release with 3, as no button is known to be held then.
const BASES: Readonly<Record<string, MouseGesture['base']>> = {
  '0M': 'press',
  '32M': 'motion',
  '0m': 'release',
  '3m': 'release',
  '64M': 'wheelup',
  '65M': 'wheeldown',
}

interface MouseGesture {
  readonly name: string
  readonly base: 'press' | 'motion' | 'release' | 'wheelup' | 'wheeldown'
  readonly at: Pointer
}

// The middle and the right button, additional buttons, motion with no button held, and the wheel's motion are nothing, whatever modifiers they carry.
function gestureOf(mouse: { [key: string]: string | undefined }): MouseGesture | undefined {
  const button = Number(mouse['button'])
  const base = BASES[`${button & ~MODIFIERS}${mouse['press']}`]
  if (base === undefined) return undefined
  const modifiers = MODIFIER_BITS.filter(([bit]) => (button & bit) !== 0)
    .map(([, modifier]) => `${modifier}+`)
    .join('')
  // A press is named by the click it can be, as an action binds a click.
  const named = base === 'press' ? 'click' : base
  // SGR mouse reports count columns and rows from 1.
  return { name: `${modifiers}${named}`, base, at: { x: Number(mouse['x']) - 1, y: Number(mouse['y']) - 1 } }
}

export interface Routes {
  /** A reply of the terminal to what the core asked, which is no key. */
  answered(sequence: string): boolean
  focused(): Part | undefined
  /** The Part took the key, so its lines changed. */
  taken(part: Part): void
  /** The left button, at the cell under the pointer counted from 0. */
  readonly pointer: {
    /** A press, by the name of the click it can be, such as `shift+click`. */
    press(at: Pointer, gesture: string): void
    /** The pointer moved to another cell while the button is held. */
    motion(at: Pointer): void
    release(at: Pointer): void
  }
  /** A key to the actions that authors set, at one step of the order: before the Part with the Focus, or after it. True when one took it. */
  actions(data: string, first: boolean): boolean
  /** A notch of the wheel, by its gesture's name, to the actions with no Place, where the core's scroll is. */
  wheel(name: string, at: Pointer): void
}

/**
 * A key goes to the actions marked `first`, then to the Part with the Focus, then to the other actions, the core's own among those with no Place.
 * A press, a motion and a release of the left button go to what selects and clicks. A notch of the wheel goes to the actions with no Place.
 */
export function route(input: StdinBuffer, routes: Routes): void {
  const toFocus = (data: string): boolean => {
    const part = routes.focused()
    if (part?.key?.(data) !== true) return false
    routes.taken(part)
    return true
  }
  input.on('data', (sequence: string) => {
    // No Part asks for a key's release yet, and the editor would type it a second time.
    if (routes.answered(sequence) || isKeyRelease(sequence)) return
    const mouse = SGR_MOUSE.exec(sequence)?.groups
    if (mouse !== undefined) {
      const gesture = gestureOf(mouse)
      if (gesture === undefined) return
      if (gesture.base === 'press') routes.pointer.press(gesture.at, gesture.name)
      else if (gesture.base === 'motion') routes.pointer.motion(gesture.at)
      else if (gesture.base === 'release') routes.pointer.release(gesture.at)
      else routes.wheel(gesture.name, gesture.at)
      return
    }
    // Raw mode turns off the terminal's own signals, so ctrl+c and ctrl+z arrive as keys, for the core's actions.
    if (routes.actions(sequence, true) || toFocus(sequence)) return
    routes.actions(sequence, false)
  })
  // The buffer takes a bracketed paste out of its markers; the editor reads a paste by them.
  input.on('paste', (content: string) => {
    toFocus(`${PASTE_START}${content}${PASTE_END}`)
  })
}
