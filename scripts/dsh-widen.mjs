#!/usr/bin/env node
// Tries the newest dsh: sets binnacle's tests on it, and widens binnacle's peers on dsh to it. CI runs the checks after, and opens a pull request when they pass.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

const PACKAGE = 'packages/binnacle/package.json'
const OPTIONS = { includePrerelease: true }

const isDsh = (name) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
const isOurs = (name) => isDsh(name) || name.startsWith('@deepseek-ai/cordis')

/** The dsh that binnacle tests on now: its dsh packages' version in devDependencies. */
export function tested(pkg) {
  const versions = new Set(
    Object.entries(pkg.devDependencies)
      .filter(([name]) => isDsh(name))
      .map(([, version]) => version),
  )
  if (versions.size !== 1) throw new Error(`binnacle tests on more than one dsh: ${[...versions].join(', ')}`)
  return [...versions][0]
}

/** The newest version of dsh that is newer than the one tested, or undefined. */
export function newest(published, current) {
  return published.filter((version) => semver.gt(version, current, OPTIONS)).toSorted((a, b) => semver.rcompare(a, b, OPTIONS))[0]
}

/** The range, from its lowest version to `version`. A range that holds it already stays. */
export function widen(range, version) {
  if (semver.satisfies(version, range, OPTIONS)) return range
  return `>=${semver.minVersion(range).version} <=${version}`
}

/**
 * binnacle's manifest on a new dsh: each dsh package tested at `version`, each cordis package at the version that dsh takes,
 * and each peer widened to what is tested.
 * @param pkg - the package's manifest.
 * @param version - the new dsh.
 * @param taken - the version of each cordis package that the new dsh takes.
 */
export function onDsh(pkg, version, taken) {
  const at = (name) => (isDsh(name) ? version : taken[name])
  const devDependencies = Object.fromEntries(
    Object.entries(pkg.devDependencies).map(([name, pin]) => [name, isOurs(name) && at(name) !== undefined ? at(name) : pin]),
  )
  const peerDependencies = Object.fromEntries(
    Object.entries(pkg.peerDependencies).map(([name, range]) => [
      name,
      isOurs(name) && at(name) !== undefined ? widen(range, at(name)) : range,
    ]),
  )
  return { ...pkg, peerDependencies, devDependencies }
}

// A step's output, for the workflow that runs this, and the log.
function output(line) {
  console.log(line)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
}

const npm = (...args) => JSON.parse(execFileSync('npm', ['view', ...args, '--json'], { encoding: 'utf8' }))

function main() {
  const root = new URL('..', import.meta.url)
  const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
  const write = (path, value) => writeFileSync(new URL(path, root), `${JSON.stringify(value, undefined, 2)}\n`)
  const pkg = read(PACKAGE)
  const version = newest(npm('@deepseek-ai/dsh', 'versions'), tested(pkg))
  if (version === undefined) {
    output('version=')
    return
  }
  // The cordis packages that the new dsh takes, at the newest version its range allows.
  const dependencies = npm(`@deepseek-ai/dsh@${version}`, 'dependencies')
  const taken = {}
  for (const name of Object.keys(pkg.devDependencies).filter((dependency) => dependency.startsWith('@deepseek-ai/cordis'))) {
    if (dependencies[name] !== undefined) taken[name] = semver.maxSatisfying(npm(name, 'versions'), dependencies[name], OPTIONS)
  }
  write(PACKAGE, onDsh(pkg, version, taken))
  // The Reference follows the dsh that binnacle tests on: its tag, and the commit the tag names.
  const references = read('references.json')
  const tag = `dsh-v${version}`
  const listing = execFileSync('git', ['ls-remote', '--tags', references.dsh.url, `refs/tags/${tag}*`], { encoding: 'utf8' })
    .trim()
    .split('\n')
  const line = listing.find((entry) => entry.endsWith('^{}')) ?? listing[0]
  if (line === undefined || line === '') throw new Error(`dsh has no tag ${tag}`)
  write('references.json', { ...references, dsh: { ...references.dsh, commit: line.split('\t')[0], tag } })
  writeFileSync(
    new URL(`.changeset/dsh-${version}.md`, root),
    `---\n'@easeshine/binnacle': patch\n---\n\nbinnacle runs on dsh ${version}, and on each dsh from ${semver.minVersion(pkg.peerDependencies['@deepseek-ai/dsh-agent']).version}.\n`,
  )
  output(`version=${version}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
