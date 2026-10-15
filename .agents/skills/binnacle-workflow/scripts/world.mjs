// The clock stands still until a test moves it, so each time a test asserts is a literal.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { run } from './task.mjs'

export function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

export function makeWorld() {
  const dir = mkdtempSync(join(tmpdir(), 'binnacle-task-'))
  const home = join(dir, 'home')
  mkdirSync(home)
  const origin = join(dir, 'origin.git')
  execFileSync('git', ['init', '--bare', '-b', 'main', origin], { stdio: 'ignore' })
  const repo = join(dir, 'repo')
  execFileSync('git', ['clone', origin, repo], { stdio: ['ignore', 'ignore', 'ignore'] })
  for (const [key, value] of [
    ['user.email', 'test@example.com'],
    ['user.name', 'Test'],
  ])
    execFileSync('git', ['config', key, value], { cwd: repo })
  mkdirSync(join(repo, '.agents'))
  writeFileSync(
    join(repo, '.agents', 'roles.json'),
    JSON.stringify({
      lead: 'claude:claude-opus-5-5',
      implementer: 'herdr:pi:zai/glm-5.3@max',
      reviewer: 'herdr:pi:openai-codex/gpt-6.1-sol@medium',
      families: { 'openai-codex': 'openai', zai: 'zai', google: 'google', anthropic: 'anthropic' },
    }),
  )
  writeFileSync(join(repo, 'README.md'), 'one\n')
  execFileSync('git', ['add', '.agents/roles.json', 'README.md'], { cwd: repo })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repo, stdio: 'ignore' })
  execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: repo, stdio: 'ignore' })

  let clock = new Date('2026-10-05T10:00:00.000Z')
  const runner = makeFakeRunner()
  const gh = makeFakeGh()
  let slept = 0
  return {
    dir,
    home,
    repo,
    deps: {
      home,
      userHome: join(dir, 'user'),
      repo,
      now: () => clock,
      // A sleep that yields to the event loop, and ends a watch that finds
      // nothing: a test's timeout fails the test, but cannot stop its loop,
      // and a loop that runs on keeps the test file from exiting.
      sleep() {
        slept += 1
        if (slept > 1000) return Promise.reject(new Error('slept 1000 times: nothing came'))
        return new Promise((resolve) => setImmediate(resolve))
      },
      env: {},
      // A choice names herdr or headless; in a test, each is the fake.
      runners: { herdr: runner, headless: runner },
      gh: (args, input) => gh.call(args, input),
      processes: async () => [],
    },
    runner,
    gh,
    // A Spec in the Lead's checkout. Merged, it is on origin/main too, so its Parts can be built.
    spec(slug, { parts = 3, door = 'Two-way: only the task tool changes.', merged = true, partDoors = {} } = {}) {
      const items = Array.from(
        { length: parts },
        (_, i) => `${i + 1}. **Slice ${i + 1}.** Behaviour ${i + 1}.${partDoors[i + 1] ? ` ${partDoors[i + 1]}` : ''}`,
      )
      const text = `# Spec: the ${slug}\n\n## Behaviour\n\n1. Some work.\n\n## Parts of the build\n\n${items.join('\n')}\n\n## Door\n\n${door}\n`
      mkdirSync(join(repo, 'intents', slug), { recursive: true })
      writeFileSync(join(repo, 'intents', slug, 'spec.md'), text)
      if (!merged) return
      execFileSync('git', ['add', 'intents'], { cwd: repo })
      execFileSync('git', ['commit', '-m', `docs: the Spec of ${slug}`], { cwd: repo, stdio: 'ignore' })
      execFileSync('git', ['push', 'origin', 'main'], { cwd: repo, stdio: 'ignore' })
    },
    // The Lead's answer to each finding, which the next pass of Round 0 reads.
    reply(slug, text = 'Each finding is fixed.\n') {
      writeFileSync(join(home, 'tasks', slug, 'reply.md'), text)
    },
    tick(ms = 60_000) {
      clock = new Date(clock.getTime() + ms)
    },
    remove() {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export function makeFakeRunner() {
  const runner = {
    starts: [],
    prompts: [],
    closed: [],
    states: {},
    failStart: new Set(),
    failPrompt: new Set(),
    async start(agent) {
      if (runner.failStart.has(agent.role)) throw new Error(`the ${agent.role} did not start`)
      runner.starts.push(agent)
      return { role: agent.role }
    },
    async prompt(handle, text) {
      if (runner.failPrompt.has(handle.role)) throw new Error('agent_prompt_stalled')
      runner.prompts.push({ role: handle.role, text })
    },
    async activity(handle) {
      return runner.states[handle.role] ?? { state: 'idle' }
    },
    async close(handle) {
      runner.closed.push(handle.role)
    },
  }
  return runner
}

export function makeFakeGh() {
  const gh = {
    calls: [],
    prs: new Map(),
    comments: [],
    closed: [],
    failures: [],
    async call(args, input) {
      gh.calls.push(args.join(' '))
      const failure = gh.failures.find((f) => f.match(args))
      if (failure !== undefined && !failure.lost) {
        gh.failures.splice(gh.failures.indexOf(failure), 1)
        return { code: 1, stdout: '', stderr: 'error connecting to api.github.com' }
      }
      const answer = gh.answer(args, input)
      if (failure !== undefined) {
        gh.failures.splice(gh.failures.indexOf(failure), 1)
        return { code: 1, stdout: '', stderr: 'error connecting to api.github.com' }
      }
      return answer
    },
    answer(args, input) {
      const [, verb, target] = args
      const byUrl = [...gh.prs.values()].find((pr) => pr.url === target)
      if (verb === 'view' && args.includes('url,state')) {
        const pr = gh.prs.get(target)
        return pr === undefined
          ? { code: 1, stdout: '', stderr: `no pull requests found for branch "${target}"` }
          : { code: 0, stdout: JSON.stringify({ url: pr.url, state: 'OPEN' }), stderr: '' }
      }
      if (verb === 'view' && args.includes('comments'))
        return {
          code: 0,
          stdout: JSON.stringify({ comments: gh.comments.filter((c) => c.url === target).map((c) => ({ body: c.body })) }),
          stderr: '',
        }
      if (verb === 'create') {
        const head = args[args.indexOf('--head') + 1]
        const url = `https://github.com/o/r/pull/${gh.prs.size + 1}`
        gh.prs.set(head, { url, title: args[args.indexOf('--title') + 1], body: input, labels: [] })
        return { code: 0, stdout: `${url}\n`, stderr: '' }
      }
      if (verb === 'edit') {
        byUrl.labels.push(args[args.indexOf('--add-label') + 1])
        return { code: 0, stdout: '', stderr: '' }
      }
      if (verb === 'close') {
        gh.closed.push({ n: target, comment: args[args.indexOf('--comment') + 1] })
        return { code: 0, stdout: '', stderr: '' }
      }
      if (verb === 'comment') {
        gh.comments.push({ url: target, body: input })
        return { code: 0, stdout: '', stderr: '' }
      }
      return { code: 1, stdout: '', stderr: `the fake gh cannot ${args.join(' ')}` }
    },
  }
  return gh
}

export function logLines(world, id) {
  return readFileSync(join(world.home, 'tasks', id.replace('/', '.'), 'log.ndjson'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

export const SPEC = 'cards'

// A Part `k` of the Spec `cards`, built: the Spec is started and approved first, once.
export async function built(world, k, ...options) {
  if (!existsSync(join(world.home, 'tasks', SPEC))) {
    world.spec(SPEC)
    await steps(world, ['start', SPEC], ['set', SPEC, 'approved', '--as', 'reviewer'])
  }
  await steps(world, ['build', `${SPEC}/${k}`, ...options])
}

export async function steps(world, ...argvs) {
  for (const argv of argvs) {
    world.tick()
    const result = await run(argv, world.deps)
    assert.equal(result.code, 0, `${argv.join(' ')}: ${result.stderr}`)
  }
}
