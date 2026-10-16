import { PACKAGE } from '../core/name.ts'

/** The bundle's rows, in its order, the modules they load, and a row's config in a test. */
export const BUILT_INS: readonly (readonly [string, string, () => Promise<object>, unknown?])[] = [
  ['binnacle-transcript', `${PACKAGE}/plugins/transcript`, () => import('../plugins/transcript/index.ts')],
  ['binnacle-transcript-view', `${PACKAGE}/plugins/transcript-view`, () => import('../plugins/transcript-view/index.ts')],
  // A test asks npm nothing.
  ['binnacle-notice', `${PACKAGE}/plugins/notice`, () => import('../plugins/notice/index.ts'), { latest: '' }],
  ['binnacle-tool-cards', `${PACKAGE}/plugins/tool-cards`, () => import('../plugins/tool-cards/index.ts')],
  ['binnacle-composer', `${PACKAGE}/plugins/composer`, () => import('../plugins/composer/index.ts')],
  ['binnacle-commands', `${PACKAGE}/plugins/commands`, () => import('../plugins/commands/index.ts')],
  ['binnacle-copy', `${PACKAGE}/plugins/copy`, () => import('../plugins/copy/index.ts')],
  ['binnacle-palette', `${PACKAGE}/plugins/palette`, () => import('../plugins/palette/index.ts')],
  ['binnacle-status-line', `${PACKAGE}/plugins/status-line`, () => import('../plugins/status-line/index.ts')],
  ['binnacle-requests', `${PACKAGE}/plugins/requests`, () => import('../plugins/requests/index.ts')],
  ['binnacle-requests-view', `${PACKAGE}/plugins/requests-view`, () => import('../plugins/requests-view/index.ts')],
]
