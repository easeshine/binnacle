#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { builderOf, familyOf, loadRoles, parseRole, pickReviewer, roleText, runHeadless } from './agents.mjs'

// A fix is small: a third Round means it is not, and it moves to the workflow.
export const ROUNDS = 2

const TIMEOUT = 45 * 60 * 1000

export function parseArgs(args) {
  const read = {}
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]]
    if (value === undefined) throw new Error(`${flag}: needs a value`)
    if (flag === '--as') read.as = value
    else if (flag === '--reviewer') read.reviewer = value
    else if (flag === '--source') read.source = value
    else throw new Error(`${flag}: not an option of pnpm review`)
  }
  if (read.as === undefined) throw new Error('name yourself with --as <tool>:<model>, such as --as claude:opus')
  return read
}

export function sourceOf(branch, given) {
  const issue = given ?? /^fix\/(\d+)/.exec(branch)?.[1]
  if (issue === undefined || !/^\d+$/.test(issue)) throw new Error(`${branch}: name the issue with --source <n>, or work on fix/<n>`)
  return Number(issue)
}

export function nextRound(files) {
  const rounds = files.map((file) => /^review-(\d+)\.md$/.exec(file)?.[1]).filter(Boolean)
  return rounds.length === 0 ? 1 : Math.max(...rounds.map(Number)) + 1
}

export function verdictOf(report) {
  const last = [...report.matchAll(/^Verdict: (approved|changes)\s*$/gm)].at(-1)
  return last?.[1]
}

export function reviewPrompt({ source, checkout, tip, earlier }) {
  return [
    'Load the `review` skill, and follow it. You review a fix.',
    `Its source is issue #${source} of this repository.`,
    `Your checkout is ${checkout}, at ${tip}. The diff is \`git diff origin/main...${tip}\`.`,
    ...(earlier.length === 0 ? [] : [`The earlier reports are ${earlier.join(', ')}.`]),
    'Give the report as your final message, in full.',
  ].join('\n')
}

export function reviewedBy({ role, family, sameFamily }) {
  const who = roleText(role)
  return sameFamily
    ? `Reviewed-by: ${who}, the builder's family (${family ?? 'unknown'}), in a fresh session`
    : `Reviewed-by: ${who} (${family})`
}

export function chooseReviewer(config, builder, given) {
  if (given === undefined) return pickReviewer(config, builder)
  const role = parseRole(given)
  const family = familyOf(role, config.families)
  return { role, family, sameFamily: family === undefined || family === familyOf(builder, config.families) }
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const root = git('rev-parse', '--show-toplevel')
  const common = join(git('rev-parse', '--path-format=absolute', '--git-common-dir'), '..')
  const branch = git('branch', '--show-current')
  if (branch === '' || branch === 'main') throw new Error('review a branch of its own, not main')
  if (git('status', '--porcelain') !== '') throw new Error('commit each change first: the reviewer reads the branch tip')
  const source = sourceOf(branch, options.source)

  const dir = join(homedir(), '.binnacle', 'reviews', branch.replaceAll('/', '-'))
  mkdirSync(dir, { recursive: true })
  const round = nextRound(readdirSync(dir))
  if (round > ROUNDS)
    throw new Error(`a fix has ${ROUNDS} Rounds: list the open findings in the PR, or move the change to the binnacle-workflow skill`)

  const tip = git('rev-parse', 'HEAD')
  git('fetch', '-q', 'origin', 'main')
  const checkout = join(dir, 'checkout')
  if (existsSync(checkout)) git('-C', checkout, 'checkout', '-q', '--detach', tip)
  else git('worktree', 'add', '-q', '--detach', checkout, tip)
  if (existsSync(join(common, '.refs')) && !existsSync(join(checkout, '.refs'))) symlinkSync(join(common, '.refs'), join(checkout, '.refs'))

  const config = loadRoles({ root, home: homedir() })
  const pick = chooseReviewer(config, builderOf(options.as), options.reviewer)
  const role = pick.role.runner === 'herdr' ? { ...pick.role, runner: 'headless' } : pick.role
  const earlier = readdirSync(dir)
    .filter((file) => /^review-\d+\.md$/.test(file))
    .map((file) => join(dir, file))
  const prompt = reviewPrompt({ source, checkout, tip, earlier })
  const report = join(dir, `review-${round}.md`)
  writeFileSync(
    join(dir, `review-${round}.json`),
    `${JSON.stringify({ round, source, tip, reviewer: roleText(role), family: pick.family, sameFamily: pick.sameFamily, at: new Date().toISOString() }, undefined, 2)}\n`,
  )

  if (role.runner === 'subagent') {
    console.log(`Round ${round}: start a subagent on ${role.model}, in the background, with this prompt:\n\n${prompt}\n`)
    console.log(`Save its final message as ${report}. Then read its last line, the verdict.`)
    console.log(reviewedBy({ ...pick, role }))
    return 0
  }
  if (role.runner !== 'headless') throw new Error(`pnpm review starts a headless or a subagent reviewer, not ${role.runner}`)

  console.error(`Round ${round}: ${roleText(role)} reviews ${tip.slice(0, 10)} in ${checkout}`)
  const text = await runHeadless(role, prompt, { cwd: checkout, timeout: TIMEOUT })
  writeFileSync(report, `${text}\n`)
  console.log(text)
  console.log(`\n${reviewedBy({ ...pick, role })}`)
  console.log(`The report is ${report}.`)
  const verdict = verdictOf(text)
  if (verdict === undefined) throw new Error(`the report has no verdict line: read ${report}`)
  return verdict === 'approved' ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`pnpm review: ${error.message}`)
      process.exit(2)
    },
  )
}
