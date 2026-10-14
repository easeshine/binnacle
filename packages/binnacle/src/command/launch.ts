import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import satisfies from 'semver/functions/satisfies.js'
import valid from 'semver/functions/valid.js'
import { PACKAGE } from '../core/name.ts'
import { find, run } from './process.ts'

/** binnacle's own dsh profile. */
export const PROFILE = 'binnacle'

export interface Launch {
  /** The arguments after `binnacle`. They go to dsh as they are, after the profile. */
  readonly argv: readonly string[]
  /** The folder of the package that runs. */
  readonly packageDir: string
  readonly env: NodeJS.ProcessEnv
  readonly platform: NodeJS.Platform
  /** Prints what the person asked for, such as the version. */
  readonly print: (line: string) => void
  /** Says one line to the person about what binnacle checks and does. */
  readonly say: (line: string) => void
  /** Starts dsh, and gives its exit code when this process goes on. */
  readonly start: (dsh: string, args: readonly string[]) => Promise<number>
}

interface Manifest {
  readonly version?: string
  readonly peerDependencies?: Record<string, string>
  readonly dependencies?: Record<string, string>
  readonly dsh?: { readonly profile?: { readonly bundles?: readonly string[] } }
}

// A package.json that npm or pnpm wrote; a field it lacks is read as absent.
const read = (path: string): Manifest | undefined => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Manifest) : undefined)

/** The dsh versions that binnacle works with: each range that its peers on dsh's packages give, as one range. */
export function dshRange(own: Manifest): string {
  const ranges = Object.entries(own.peerDependencies ?? {})
    .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
    .map(([, range]) => range)
  return [...new Set(ranges)].join(' ')
}

/** What binnacle's profile holds of binnacle. */
type Held =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'foreign' }
  | { readonly kind: 'version'; readonly version: string }
  | { readonly kind: 'checkout'; readonly dir: string }

/** The binnacle that runs: a version from npm, or a checkout, which is in no node_modules. */
type Wanted = { readonly kind: 'version'; readonly version: string } | { readonly kind: 'checkout'; readonly dir: string }

function heldIn(profileDir: string): Held {
  const manifest = read(join(profileDir, 'package.json'))
  if (manifest === undefined) return { kind: 'nothing' }
  if (manifest.dependencies?.[PACKAGE] === undefined) return { kind: 'foreign' }
  const installed = join(profileDir, 'node_modules', PACKAGE)
  if (!existsSync(join(installed, 'package.json'))) return { kind: 'nothing' }
  const dir = realpathSync(installed)
  // pnpm links a checkout, and copies a version from npm into the profile.
  if (relative(realpathSync(profileDir), dir).startsWith('..')) return { kind: 'checkout', dir }
  return { kind: 'version', version: read(join(dir, 'package.json'))?.version ?? '' }
}

function agrees(held: Held, wanted: Wanted): boolean {
  if (held.kind === 'version' && wanted.kind === 'version') return held.version === wanted.version
  if (held.kind === 'checkout' && wanted.kind === 'checkout') return held.dir === wanted.dir
  return false
}

function named(held: Held | Wanted): string {
  if (held.kind === 'version') return `binnacle ${held.version}`
  if (held.kind === 'checkout') return `binnacle's checkout at ${held.dir}`
  return 'no binnacle'
}

// A range with a space or a comparison is one argument to the shell only in quotes.
const spec = (range: string) => (/^[\w.-]+$/.test(range) ? `@deepseek-ai/dsh@${range}` : `"@deepseek-ai/dsh@${range}"`)

function dshHome(env: NodeJS.ProcessEnv): string {
  const configured = env.DSH_HOME?.trim()
  return configured === undefined || configured === '' ? join(homedir(), '.dsh') : resolve(configured.replace(/^~(?=$|[\\/])/, homedir()))
}

/**
 * Checks dsh, keeps binnacle's profile at the binnacle that runs, and starts dsh with that profile.
 * Each version that disagrees is said, with what binnacle does or what the person runs.
 * @returns the exit code, when binnacle does not start or dsh ends as a child.
 */
export async function launch(options: Launch): Promise<number> {
  const { argv, env, platform, say } = options
  const own = read(join(options.packageDir, 'package.json')) ?? {}
  const version = own.version ?? ''
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-V')) {
    options.print(`binnacle ${version}`)
    return 0
  }

  const range = dshRange(own)
  const dsh = find('dsh', env, platform)
  if (dsh === undefined) {
    say(`binnacle: binnacle ${version} runs on dsh ${range}, and dsh is not installed. Install it: npm install -g ${spec(range)}`)
    return 1
  }
  const dshVersion = valid(run(dsh, ['--version'], env, platform, false).stdout.trim().split('\n').at(-1) ?? '')
  if (dshVersion === null) {
    say(`binnacle: \`${dsh} --version\` gave no version. Reinstall dsh: npm install -g ${spec(range)}`)
    return 1
  }
  if (!satisfies(dshVersion, range, { includePrerelease: true })) {
    say(`binnacle: binnacle ${version} runs on dsh ${range}, and dsh is ${dshVersion}.`)
    say(`Install the dsh that binnacle runs on: npm install -g ${spec(range)}. Or install a binnacle that runs on dsh ${dshVersion}.`)
    return 1
  }

  const profileDir = join(dshHome(env), 'profiles', PROFILE)
  const packageDir = realpathSync(options.packageDir)
  const wanted: Wanted = packageDir.split(sep).includes('node_modules')
    ? { kind: 'version', version }
    : { kind: 'checkout', dir: packageDir }
  const held = heldIn(profileDir)
  if (held.kind === 'foreign') {
    say(`binnacle: the dsh profile ${PROFILE}, at ${profileDir}, is not binnacle's: it does not depend on ${PACKAGE}.`)
    say(`binnacle changes no profile it did not make. Move that folder away, and binnacle makes its own.`)
    return 1
  }
  if (!agrees(held, wanted)) {
    say(
      held.kind === 'nothing'
        ? `binnacle: installing ${named(wanted)} into its dsh profile, ${PROFILE}`
        : `binnacle: the dsh profile ${PROFILE} has ${named(held)}, and this is ${named(wanted)}: installing it`,
    )
    if (find('pnpm', env, platform) === undefined) {
      say('binnacle: dsh installs binnacle with pnpm, and pnpm is not installed. Install it: https://pnpm.io/installation')
      return 1
    }
    const added = wanted.kind === 'version' ? `${PACKAGE}@${wanted.version}` : `link:${wanted.dir}`
    const { status } = run(dsh, ['plugin', '--profile', PROFILE, 'add', added], env, platform, true)
    if (status !== 0) {
      say(`binnacle: dsh could not install ${named(wanted)} into the profile ${PROFILE}; it says why above.`)
      return status
    }
    const now = heldIn(profileDir)
    if (!agrees(now, wanted)) {
      say(`binnacle: after the install, the dsh profile ${PROFILE} has ${named(now)}.`)
      say(`Install it yourself: dsh plugin --profile ${PROFILE} add ${added}`)
      return 1
    }
  }
  const bundles = read(join(profileDir, 'package.json'))?.dsh?.profile?.bundles ?? []
  if (!bundles.includes(PACKAGE)) {
    say(
      `binnacle: the dsh profile ${PROFILE} does not load binnacle. Add "${PACKAGE}" to dsh.profile.bundles in ${join(profileDir, 'package.json')}.`,
    )
    return 1
  }
  return options.start(dsh, ['--profile', PROFILE, ...argv])
}
