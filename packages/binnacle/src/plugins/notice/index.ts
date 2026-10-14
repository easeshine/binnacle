import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { HeadLook, Line } from '../transcript/index.ts'

export const name = 'binnacle-notice'

export const inject = ['binnacle'] satisfies (keyof Context)[]

/** A new version of binnacle: the version out, the version that runs, what a person runs to install it, and where its changes are. */
export interface Update {
  readonly version: string
  readonly current: string
  readonly command: string
  readonly changelog: string
}

/** The Look `notice.update`: the notice's lines, given the update and the transcript's width. */
export type UpdateLook = (update: Update, width: number) => Line[]

export interface Config {
  /** The URL where npm gives the package's newest version, its `latest`. `''` asks nothing, as in a test. */
  readonly latest?: string
  /** The file that keeps the newest version told, so that each is told once. */
  readonly told?: string
}

interface Manifest {
  readonly name: string
  readonly version: string
  readonly repository?: { readonly url?: string }
}

// The package's own package.json: the first one up from this file, in its source and in its build.
function manifest(): Manifest {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir)
  // The package's own manifest, which its build writes.
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
}

const expanded = (path: string) => resolve(path.replace(/^~(?=$|[\\/])/, homedir()))

// As dsh finds its home: DSH_HOME, else ~/.dsh.
function dshHome(): string {
  const configured = process.env.DSH_HOME?.trim()
  return configured === undefined || configured === '' ? join(homedir(), '.dsh') : expanded(configured)
}

const parts = (version: string) => /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version.trim())

/** Whether `version` is newer than `current`, as semver orders them: a release after its prereleases. */
export function newer(version: string, current: string): boolean {
  const a = parts(version)
  const b = parts(current)
  if (a === null || b === null) return false
  for (const at of [1, 2, 3]) {
    const by = Number(a[at]) - Number(b[at])
    if (by !== 0) return by > 0
  }
  if (a[4] === undefined || b[4] === undefined) return a[4] === undefined && b[4] !== undefined
  return a[4].localeCompare(b[4], 'en', { numeric: true }) > 0
}

async function newest(url: string, unloaded: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.any([unloaded, AbortSignal.timeout(10_000)]),
    })
    if (!response.ok) return undefined
    // npm's reply, read as unknown: only a string `version` is used.
    const { version } = (await response.json()) as { version?: unknown }
    return typeof version === 'string' ? version : undefined
  } catch {
    // Offline, or npm slow: there is nothing to tell.
    return undefined
  }
}

function toldIn(file: string): string | undefined {
  try {
    // The file that this plugin writes.
    return (JSON.parse(readFileSync(file, 'utf8')) as { told?: string }).told
  } catch {
    return undefined
  }
}

function tell(file: string, version: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify({ told: version })}\n`)
  } catch {
    // A file that cannot be written tells the version again at the next start, which is all it costs.
  }
}

export function apply(ctx: Context, config: Config = {}): void {
  const { binnacle } = ctx
  const own = manifest()
  const told = config.told === undefined ? join(dshHome(), 'binnacle', 'notice.json') : expanded(config.told)
  const repository = own.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '')
  const unloaded = new AbortController()
  ctx.effect(() => () => unloaded.abort(), 'binnacle-notice: npm is waited for no more')

  const drawn: UpdateLook = ({ version, command, changelog }, width) => {
    const rule = binnacle.paint('warning', binnacle.tokens.glyphs.rule.repeat(width))
    return [
      rule,
      ` ${binnacle.paint({ ...binnacle.tokens.colors.warning, bold: true }, 'Update Available')}`,
      ` ${binnacle.paint('muted', `New version ${version} is available. Run `)}${binnacle.paint('accent', command)}`,
      ` ${binnacle.paint('muted', 'Changelog: ')}${binnacle.paint('accent', changelog)}`,
      rule,
      '',
    ]
  }

  const latest = config.latest ?? `https://registry.npmjs.org/${own.name}/latest`
  if (latest === '') return
  void newest(latest, unloaded.signal).then((version) => {
    if (version === undefined || unloaded.signal.aborted || !newer(version, own.version) || toldIn(told) === version) return
    const update: Update = {
      version,
      current: own.version,
      command: `npm install -g ${own.name}`,
      changelog: repository === undefined ? `https://www.npmjs.com/package/${own.name}` : `${repository}/releases`,
    }
    binnacle.look<HeadLook>('transcript.head', (beneath) => (width) => [
      ...beneath(width),
      ...binnacle.lookOf<UpdateLook>(['notice.update'], drawn)(update, width),
    ])
    tell(told, version)
  })
}
