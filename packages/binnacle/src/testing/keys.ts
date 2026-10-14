const KEYS: Readonly<Record<string, string>> = {
  enter: '\r',
  escape: '\x1b',
  tab: '\t',
  'shift+tab': '\x1b[Z',
  backspace: '\x7f',
  delete: '\x1b[3~',
  space: ' ',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  home: '\x1b[H',
  end: '\x1b[F',
  pageup: '\x1b[5~',
  pagedown: '\x1b[6~',
}

export function sequenceOf(key: string): string {
  const letter = /^ctrl\+([a-z])$/.exec(key)?.[1]
  if (letter !== undefined) return String.fromCharCode(letter.charCodeAt(0) - 96)
  const sequence = KEYS[key]
  if (sequence === undefined) throw new Error(`binnacle/testing: no key is named ${key}`)
  return sequence
}

// Longer than the input's wait for the rest of a sequence that starts with escape.
export const ESCAPE_WAIT_MS = 60

// SGR mouse reports: a press, a motion, or a release, at a cell counted from 1.
export const mouse = (button: number, x: number, y: number, release = false): string =>
  `\x1b[<${button};${x + 1};${y + 1}${release ? 'm' : 'M'}`
export const MOTION = 32
