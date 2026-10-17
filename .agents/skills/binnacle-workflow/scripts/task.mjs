// The deps hold the world: home, checkout, clock and sleep. So a test drives the tool as a process would.
import { execFile, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { familiesSetUp, familyOf, loadRoles, parseRole, roleText } from '../../../roles.mjs'
import { handoffFor } from './handoffs.mjs'
import { marker, messageOf, PR_SECTIONS, prBody, reportComment, reportsOf, withTrailers } from './land.mjs'
import { locked } from './lock.mjs'
import { makeHeadless } from './runners/headless.mjs'
import { makeHerdr } from './runners/herdr.mjs'
import { doorOf, partsOf, specPath, titleOf } from './spec.mjs'
import {
  appendEvent,
  folderOf,
  followers,
  nameOf,
  OWNERS,
  ownerOf,
  parseId,
  readAgents,
  readEvents,
  readLog,
  readTask,
  readTasks,
  writeJson,
} from './state.mjs'
import { lastRecord, watch } from './watch.mjs'

class Refusal extends Error {}

class Usage extends Error {}

class HandoffFailed extends Error {
  constructor(message) {
    super(message)
    this.exitCode = 3
  }
}

const ROLES = ['lead', 'implementer', 'reviewer']

function git(repo, args) {
  const done = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
  if (done.status !== 0) throw new Refusal(`git ${args.join(' ')} failed: ${(done.stderr || done.stdout).trim()}`)
  return done.stdout.trim()
}

function idOf(text, kind) {
  const read = parseId(text)
  if (read === undefined) throw new Usage(`${text ?? 'nothing'}: not a Task; a Task is <slug> or <slug>/<k>`)
  if (kind === 'spec' && read.part !== undefined) throw new Usage(`${text}: a Spec's Task is its slug alone`)
  if (kind === 'part' && read.part === undefined) throw new Usage(`${text}: a Part's Task is <slug>/<k>`)
  return read
}

function parseOptions(args, env = {}) {
  const read = { as: env.BINNACLE_ROLE ?? 'lead', force: false }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--as') {
      if (!ROLES.includes(args[i + 1] ?? '')) throw new Usage(`--as takes lead, implementer or reviewer, not ${args[i + 1] ?? 'nothing'}`)
      if (env.BINNACLE_ROLE !== undefined && env.BINNACLE_ROLE !== args[i + 1])
        throw new Refusal(`--as ${args[i + 1]} differs from BINNACLE_ROLE ${env.BINNACLE_ROLE}`)
      read.as = args[i + 1]
      i += 1
    } else if (args[i] === '--force') read.force = true
    else throw new Usage(`${args[i]}: not an option this command takes`)
  }
  return read
}

// The Lead takes a role that runs as `lead` or `subagent`: the tool starts no agent for it, and gives the Lead each prompt.
const RELAYED = ['lead', 'subagent']

function configOf(deps) {
  try {
    return loadRoles({ root: deps.repo, binnacle: deps.home })
  } catch (error) {
    throw new Refusal(error.message)
  }
}

// A choice is a role, such as `subagent:sonnet` or `headless:pi:zai/glm-5.3@max`. The builder may also be `lead`.
function chosen(role, text, config) {
  let read
  try {
    read = parseRole(text)
  } catch (error) {
    throw new Usage(error.message)
  }
  if (read.runner === 'lead' && role !== 'implementer') throw new Usage(`${text}: only the builder can be the Lead`)
  return withFamily(role, read, config)
}

function withFamily(role, read, config) {
  const family =
    read.runner === 'lead'
      ? config.lead === undefined
        ? undefined
        : familyOf(config.lead, config.families)
      : familyOf(read, config.families)
  if (family === undefined)
    throw new Refusal(
      read.runner === 'lead'
        ? 'the Lead has no family; name it as lead in roles.json, such as "lead": "claude:opus"'
        : `${roleText(read)}: no family; add its provider to families in roles.json`,
    )
  return { role, ...read, family }
}

function defaultOf(role, config) {
  return withFamily(role, config.roles[role], config)
}

function settingOf(agent) {
  const { handle: _handle, startedAt: _startedAt, ...setting } = agent
  return setting
}

function parseChoices(args, allowed, usage) {
  const read = { sameFamily: false }
  for (let i = 0; i < args.length; i++) {
    const option = args[i]
    if (!allowed.includes(option)) throw new Usage(usage)
    if (option === '--same-family') read.sameFamily = true
    else if (option === '--fresh-reviewer') read.freshReviewer = true
    else {
      if (args[i + 1] === undefined) throw new Usage(usage)
      read[option.slice(2)] = args[i + 1]
      i += 1
    }
  }
  return read
}

async function command(argv, deps, say) {
  const [name, ...rest] = argv
  const env = deps.env ?? {}
  // An agent's environment names its task, so its commands can leave it out.
  const named = parseId(rest[0]) !== undefined && existsSync(folderOf(deps.home, rest[0]))
  const args = name !== 'watch' && !named && env.BINNACLE_TASK !== undefined && name !== 'status' ? [env.BINNACLE_TASK, ...rest] : rest
  switch (name) {
    case 'start': {
      const [nText, ...more] = args
      const usage = 'usage: task start <slug> [--reviewer <role>]'
      return start(idOf(nText, 'spec'), parseChoices(more, ['--reviewer'], usage), deps, say)
    }
    case 'build': {
      const [nText, ...more] = args
      const usage = 'usage: task build <slug>/<k> [--by <role>] [--reviewer <role> | --fresh-reviewer] [--same-family]'
      const read = parseChoices(more, ['--by', '--reviewer', '--fresh-reviewer', '--same-family'], usage)
      if (read.freshReviewer && read.reviewer !== undefined) throw new Usage(usage)
      return build(idOf(nText, 'part'), read, deps, say)
    }
    case 'land': {
      const [nText, ...more] = args
      if (more.length > 0) throw new Usage('usage: task land <slug>/<k>')
      return land(idOf(nText, 'part').id, deps, say)
    }
    case 'set': {
      const [nText, state, ...more] = args
      if (state === undefined) throw new Usage('usage: task set <task> <state> [--as <role>]')
      return setState(idOf(nText).id, state, parseOptions(more, env), deps, say)
    }
    case 'ask': {
      const [nText, ...more] = args
      return ask(idOf(nText).id, parseOptions(more, env), deps, say)
    }
    case 'answer': {
      const [nText, ...more] = args
      if (more.length > 0) throw new Usage('usage: task answer <task>')
      return answer(idOf(nText).id, deps, say)
    }
    case 'resend': {
      const [nText, ...more] = args
      if (more.length > 0) throw new Usage('usage: task resend <task>')
      return resend(idOf(nText).id, deps, say)
    }
    case 'status': {
      if (args.length > 1) throw new Usage('usage: task status [<task>]')
      const id = args.length === 1 ? idOf(args[0]).id : env.BINNACLE_TASK === undefined ? undefined : idOf(env.BINNACLE_TASK).id
      return status(deps, id, say)
    }
    case 'stop': {
      const [nText, ...more] = args
      return stop(idOf(nText).id, parseOptions(more, env), deps, say)
    }
    case 'watch':
      if (args.length > 0) throw new Usage('usage: task watch')
      return watch(deps, say)
    default:
      throw new Usage(`usage: task <start|build|set|ask|answer|resend|status|watch|land|stop> ...`)
  }
}

async function start(read, choices, deps, say) {
  const config = configOf(deps)
  const reviewer = choices.reviewer === undefined ? defaultOf('reviewer', config) : chosen('reviewer', choices.reviewer, config)
  const { id, slug } = read
  if (!existsSync(join(deps.repo, specPath(slug)))) throw new Refusal(`no Spec ${specPath(slug)}; write it first`)
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    const review = join(deps.home, 'worktrees', `${nameOf(id)}-review`)
    for (const [what, path] of [
      ['task folder', folder],
      ['worktree', review],
    ])
      if (existsSync(path)) throw new Refusal(`task ${id}: the ${what} ${path} exists already`)
    mkdirSync(join(deps.home, 'worktrees'), { recursive: true })
    try {
      git(deps.repo, ['fetch', 'origin', 'main'])
      git(deps.repo, ['worktree', 'add', '--detach', review, 'origin/main'])
      mkdirSync(folder, { recursive: true })
      writeJson(join(folder, 'task.json'), { id, kind: 'spec', slug, createdAt: deps.now().toISOString() })
      writeJson(join(folder, 'agents.json'), { reviewer })
      appendLine(join(folder, 'log.ndjson'), { at: deps.now().toISOString(), role: 'lead', from: null, to: 'spec', round: 0 })
    } catch (error) {
      // The checks above proved that neither existed, so each one that is there now is this start's own doing.
      spawnSync('git', ['worktree', 'remove', '--force', review], { cwd: deps.repo })
      rmSync(folder, { recursive: true, force: true })
      throw error
    }
    say(`task ${id}: spec round 0, review checkout ${review}`)
    relay(id, await deliver(id, folder, handoffFor({ kind: 'start' }, context(id, folder, deps)), deps, { quiet: true }), say)
    return 0
  })
}

// A prompt for a role that the Lead takes, from a command that the Lead ran: the Lead reads it here, and the watch stays quiet.
function relay(id, relayed, say) {
  if (relayed !== undefined) say(`task ${id}: for the ${relayed.role} (${relayed.runner}): ${relayed.text}`)
}

function context(id, folder, deps) {
  const lines = readLog(folder)
  const last = lines.at(-1)
  const record = readTask(folder)
  // A Part that shares its Spec's Reviewer is reviewed in the Spec's checkout.
  const reviewedIn = readAgents(folder).reviewer?.of ?? id
  return {
    id,
    slug: record.slug,
    part: record.part,
    branch: record.branch,
    repo: deps.repo,
    folder,
    worktree: join(deps.home, 'worktrees', nameOf(id)),
    review: join(deps.home, 'worktrees', `${nameOf(reviewedIn)}-review`),
    sharedReviewer: reviewedIn !== id,
    round: last.round,
    pass: lines.filter((line) => line.to === 'spec' && line.round === 0).length,
  }
}

async function deliver(id, folder, handoff, deps, extra = {}) {
  if (handoff === undefined) return undefined
  const hid = `h${readEvents(folder).filter((event) => event.event === 'handoff').length + 1}`
  appendEvent(folder, {
    at: deps.now().toISOString(),
    event: 'handoff',
    role: handoff.role,
    detail: { id: hid, start: handoff.start, text: handoff.text, ...extra },
  })
  return tryHandoff(id, folder, hid, handoff, deps, extra)
}

async function tryHandoff(id, folder, hid, handoff, deps, extra) {
  const event = (name, detail) =>
    appendEvent(folder, { at: deps.now().toISOString(), event: name, role: handoff.role, detail: { id: hid, ...detail } })
  try {
    // A Part's Reviewer is its Spec's own agent, unless it was given its own: it is read, started and kept in the Spec's folder.
    const of = readAgents(folder)[handoff.role]?.of
    const owner = of === undefined ? { id, folder } : { id: of, folder: folderOf(deps.home, of) }
    const agents = readAgents(owner.folder)
    let agent = agents[handoff.role]
    // The Lead takes this role, or passes the prompt to its subagent: the prompt wakes the Lead, and starts no agent.
    if (RELAYED.includes(agent?.runner)) {
      // A hand-off that the Lead's own command made does not wake the Lead.
      event('for-lead', { runner: agent.runner, text: handoff.text, ...(extra.quiet ? { quiet: true } : {}) })
      return extra.quiet ? { role: handoff.role, runner: agent.runner, text: handoff.text } : undefined
    }
    // An agent that was chosen, but not yet started, has no handle.
    let state = agent?.handle === undefined ? 'gone' : (await runnerOf(agent.runner, deps).activity(agent.handle)).state
    if (state === 'unknown') throw new Error(`the ${handoff.role}'s state is unknown; look at it before you resend`)
    if (state === 'gone') {
      const setting = agent === undefined ? defaultOf(handoff.role, configOf(deps)) : settingOf(agent)
      const runner = runnerOf(setting.runner, deps)
      const sessionDir = join(owner.folder, 'agents', handoff.role, 'sessions')
      const cwd = join(deps.home, 'worktrees', handoff.role === 'reviewer' ? `${nameOf(owner.id)}-review` : nameOf(owner.id))
      // An agent that ran before continues its session; a new one may start from a copy of another's.
      const resume = agent?.handle !== undefined
      const session = `${nameOf(owner.id)}-${handoff.role}`
      const handle = await runner.start({
        n: nameOf(owner.id),
        role: handoff.role,
        tool: setting.tool,
        model: setting.model,
        ...(setting.thinking === undefined ? {} : { thinking: setting.thinking }),
        cwd,
        sessionDir,
        session,
        ...(resume ? { resume } : setting.fork === undefined ? {} : { fork: setting.fork }),
        env: { BINNACLE_TASK: owner.id, BINNACLE_ROLE: handoff.role },
      })
      agent = { ...setting, role: handoff.role, cwd, sessionDir, session, handle, startedAt: deps.now().toISOString() }
      writeJson(join(owner.folder, 'agents.json'), { ...agents, [handoff.role]: agent })
      event('started', { runner: setting.runner, ...(of === undefined ? {} : { of }) })
    }
    await runnerOf(agent.runner, deps).prompt(agent.handle, handoff.text, (tried, code) => event('resent', { try: tried, code }))
    event('prompted', extra)
    return undefined
  } catch (error) {
    event('handoff-failed', { error: error.message })
    throw new HandoffFailed(`task ${id}: the hand-off ${hid} to the ${handoff.role} failed: ${error.message}; run task resend ${id}`)
  }
}

// pi names each session file by the time it began, so the newest sorts last.
function newestSession(dir) {
  if (!existsSync(dir)) return undefined
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.jsonl'))
    .toSorted()
  return files.length === 0 ? undefined : join(dir, files.at(-1))
}

function runnerOf(name, deps) {
  const runner = deps.runners?.[name]
  if (runner === undefined) throw new Error(`no runner ${name ?? '(none)'}; the runners are ${Object.keys(deps.runners ?? {}).join(', ')}`)
  return runner
}

// The Spec as main holds it: a Part is built only from a Spec that is merged.
function specOnMain(deps, slug) {
  const shown = spawnSync('git', ['show', `origin/main:${specPath(slug)}`], { cwd: deps.repo, encoding: 'utf8' })
  if (shown.status !== 0) throw new Refusal(`origin/main has no ${specPath(slug)}; merge the Spec first`)
  return shown.stdout
}

async function build(read, choices, deps, say) {
  const config = configOf(deps)
  const { id, slug, part } = read
  return locked(deps, async () => {
    const specFolder = folderOf(deps.home, slug)
    if (!existsSync(join(specFolder, 'task.json'))) throw new Refusal(`the Spec ${slug} has no task folder; run task start ${slug} first`)
    const last = readLog(specFolder).at(-1)
    if (last.to !== 'approved' || last.round !== 0)
      throw new Refusal(`the Spec ${slug} is ${last.to} at round ${last.round}; task build follows its approved at round 0`)
    git(deps.repo, ['fetch', 'origin', 'main'])
    if (!partsOf(specOnMain(deps, slug)).some((one) => one.k === part))
      throw new Refusal(`the Spec ${slug} on origin/main has no Part ${part} under its Parts of the build`)
    const builder = choices.by === undefined ? defaultOf('implementer', config) : chosen('implementer', choices.by, config)
    const ofSpec = readAgents(specFolder).reviewer
    const reviewer =
      choices.reviewer !== undefined
        ? chosen('reviewer', choices.reviewer, config)
        : ofSpec !== undefined
          ? settingOf(ofSpec)
          : defaultOf('reviewer', config)
    // What the Part's agents.json holds: the Spec's own Reviewer, a copy of its session, or a Reviewer chosen for the Part.
    let kept = reviewer
    if (choices.reviewer === undefined && ofSpec !== undefined) {
      if (!choices.freshReviewer) kept = { role: 'reviewer', of: slug }
      else {
        if (ofSpec.runner !== 'herdr' || ofSpec.tool !== 'pi')
          throw new Refusal(`the Spec ${slug}'s Reviewer runs as ${roleText(ofSpec)}; --fresh-reviewer forks only pi's session in herdr`)
        const fork = newestSession(join(specFolder, 'agents', 'reviewer', 'sessions'))
        if (fork === undefined) throw new Refusal(`the Spec ${slug}'s Reviewer has no session to fork`)
        kept = { ...reviewer, fork }
      }
    } else if (choices.freshReviewer) throw new Refusal(`the Spec ${slug} has no Reviewer to fork`)
    const shared = kept.of !== undefined
    // With two families set up, one family for both roles is a choice. With one, it is all there is, and the PR says so.
    const sameFamily = builder.family === reviewer.family
    if (sameFamily && !choices.sameFamily && familiesSetUp(config).size > 1)
      throw new Refusal(`the builder and the reviewer are of the same family ${builder.family}; choose another, or pass --same-family`)

    const folder = folderOf(deps.home, id)
    const worktree = join(deps.home, 'worktrees', nameOf(id))
    const review = `${worktree}-review`
    for (const [what, path] of [['task folder', folder], ['worktree', worktree], ...(shared ? [] : [['worktree', review]])])
      if (existsSync(path)) throw new Refusal(`task ${id}: the ${what} ${path} exists already`)
    const branch = `task/${nameOf(id)}`
    const probe = spawnSync('git', ['rev-parse', '--verify', '--quiet', branch], { cwd: deps.repo })
    if (probe.status === 0) throw new Refusal(`task ${id}: the branch ${branch} exists already`)
    mkdirSync(join(deps.home, 'worktrees'), { recursive: true })
    let base
    try {
      git(deps.repo, ['worktree', 'add', '-b', branch, worktree, 'origin/main'])
      if (!shared) git(deps.repo, ['worktree', 'add', '--detach', review, 'origin/main'])
      base = git(deps.repo, ['rev-parse', 'origin/main'])
      mkdirSync(folder, { recursive: true })
      writeJson(join(folder, 'task.json'), {
        id,
        kind: 'part',
        slug,
        part,
        branch,
        worktree,
        sameFamily,
        createdAt: deps.now().toISOString(),
      })
      writeJson(join(folder, 'agents.json'), {
        implementer: { ...builder, ...(RELAYED.includes(builder.runner) ? { startedAt: deps.now().toISOString() } : {}) },
        reviewer: kept,
      })
      // A Part begins where its Spec's Round 0 ended.
      appendLine(join(folder, 'log.ndjson'), { at: deps.now().toISOString(), role: 'lead', from: null, to: 'approved', round: 0 })
    } catch (error) {
      spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: deps.repo })
      if (!shared) spawnSync('git', ['worktree', 'remove', '--force', review], { cwd: deps.repo })
      spawnSync('git', ['branch', '-D', branch], { cwd: deps.repo })
      rmSync(folder, { recursive: true, force: true })
      throw error
    }
    say(`task ${id}: Part ${part} of ${slug}, built from ${base.slice(0, 7)}${sameFamily ? `, by one family, ${builder.family}` : ''}`)
    const quiet = RELAYED.includes(builder.runner) ? { quiet: true } : {}
    relay(id, await deliver(id, folder, handoffFor({ kind: 'build' }, context(id, folder, deps)), deps, { base, ...quiet }), say)
    return 0
  })
}

async function land(id, deps, say) {
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    const record = readTask(folder)
    if (record.kind !== 'part') throw new Refusal(`task ${id} is not a Part; task land lands a Part`)
    const events = readEvents(folder)
    const landed = events.find((event) => event.event === 'landed')
    if (landed !== undefined) throw new Refusal(`task ${id} has landed already: ${landed.detail.url}`)
    const last = readLog(folder).at(-1)
    if (last.to !== 'approved' || last.round === 0)
      throw new Refusal(`task ${id} is ${last.to} at round ${last.round}; task land follows approved after round 0`)
    const messagePath = join(folder, 'message.md')
    if (!existsSync(messagePath)) throw new Refusal(`no message.md in ${folder}`)
    const message = readFileSync(messagePath, 'utf8')
    const { header } = messageOf(message)
    if (header === '') throw new Refusal(`${messagePath}: its first line, the header, is empty`)
    const prPath = join(folder, 'pr.md')
    if (!existsSync(prPath)) throw new Refusal(`no pr.md in ${folder}; write it with the \`pr\` skill`)
    const prText = readFileSync(prPath, 'utf8')
    const missing = PR_SECTIONS.filter((name) => !new RegExp(`^## ${name}$`, 'm').test(prText))
    if (missing.length > 0) throw new Refusal(`${prPath}: it has no ${missing.map((name) => `## ${name}`).join(', ')}`)
    const reports = reportsOf(readdirSync(folder))
    if (!reports.some((file) => /^review-[1-9]/.test(file))) throw new Refusal(`no review report of a round after round 0 in ${folder}`)
    git(deps.repo, ['fetch', 'origin', 'main'])
    const spec = specOnMain(deps, record.slug)
    const parts = partsOf(spec)
    const part = parts.find((one) => one.k === record.part)
    if (part === undefined) throw new Refusal(`the Spec ${record.slug} on origin/main has no Part ${record.part}`)
    const door = doorOf(part.text, spec)
    if (door === undefined)
      throw new Refusal(
        `the Part ${record.part} of ${record.slug} names no Door, and its Spec's ## Door does not start with One-way or Two-way`,
      )
    const place = { k: record.part, of: parts.length, title: titleOf(spec), file: specPath(record.slug) }
    const agents = readAgents(folder)
    const config = configOf(deps)
    const sameFamily = record.sameFamily === true
    const full = withTrailers(message, {
      builder: agents.implementer?.runner === 'lead' ? { runner: 'lead', lead: config.lead } : agents.implementer,
      reviewer: agents.reviewer?.of === undefined ? agents.reviewer : readAgents(folderOf(deps.home, agents.reviewer.of)).reviewer,
      sameFamily,
    })
    const worktree = join(deps.home, 'worktrees', nameOf(id))
    const branch = record.branch
    if (git(worktree, ['status', '--porcelain']) !== '') throw new Refusal(`${worktree} has changes that are not committed`)
    git(worktree, ['fetch', 'origin', 'main'])
    if (spawnSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: worktree }).status !== 0)
      throw new Refusal(`${branch} does not hold origin/main; merge or rebase it first`)

    const step = async (name, body) => {
      try {
        return await body()
      } catch (error) {
        throw new Refusal(`task ${id}: land stopped at ${name}: ${error.message}; run task land ${id} again`)
      }
    }
    const event = (name, detail) => appendEvent(folder, { at: deps.now().toISOString(), event: name, role: 'lead', detail })

    await step('the squash', () => {
      const one = git(worktree, ['rev-list', '--count', 'origin/main..HEAD']) === '1'
      // Compare with the message as Git keeps it: the commit below cleans it
      // with `--cleanup=whitespace`, as `git stripspace` does.
      const kept = spawnSync('git', ['stripspace'], { cwd: worktree, input: full, encoding: 'utf8' }).stdout.trim()
      if (one && git(worktree, ['log', '-1', '--format=%B']).trim() === kept) return
      const before = git(worktree, ['rev-parse', 'HEAD'])
      git(worktree, ['reset', '--soft', 'origin/main'])
      // The cleanup is named, not taken from Git's settings, so that it is the one the check above undoes.
      const done = spawnSync('git', ['commit', '--cleanup=whitespace', '-F', '-'], { cwd: worktree, input: full, encoding: 'utf8' })
      if (done.status !== 0) {
        // Put the branch back, so the worktree is clean for the next run.
        git(worktree, ['reset', '--soft', before])
        throw new Error((done.stderr || done.stdout).trim())
      }
    })
    await step('the push', () => git(worktree, ['push', '--force-with-lease', 'origin', branch]))
    const url = await step('the PR', async () => {
      const open = await deps.gh(['pr', 'view', branch, '--json', 'url,state'])
      if (open.code === 0) {
        const pr = JSON.parse(open.stdout)
        if (pr.state === 'OPEN') return pr.url
      }
      const checkedPath = join(folder, 'checked.md')
      const checked = existsSync(checkedPath) ? readFileSync(checkedPath, 'utf8') : undefined
      const made = await deps.gh(
        ['pr', 'create', '--base', 'main', '--head', branch, '--title', header, '--body-file', '-'],
        prBody({ message, pr: prText, part: part.text, door, checked, reports, place, sameFamily }),
      )
      if (made.code !== 0) throw new Error(made.stderr.trim())
      const address = made.stdout.trim().split('\n').at(-1)
      event('pr', { url: address })
      return address
    })
    if (door === 'one-way')
      await step('the label', async () => {
        const labelled = await deps.gh(['pr', 'edit', url, '--add-label', 'one-way'])
        if (labelled.code !== 0) throw new Error(labelled.stderr.trim())
      })
    await step('the reports', async () => {
      // GitHub is the record of what was posted: a comment that GitHub took,
      // but whose answer was lost, is found here and not posted twice.
      const read = await deps.gh(['pr', 'view', url, '--json', 'comments'])
      if (read.code !== 0) throw new Error(read.stderr.trim())
      const posted = JSON.parse(read.stdout).comments.map((comment) => comment.body)
      for (const file of reports) {
        if (posted.some((body) => body.startsWith(marker(file)))) continue
        const sent = await deps.gh(
          ['pr', 'comment', url, '--body-file', '-'],
          reportComment(file, readFileSync(join(folder, file), 'utf8')),
        )
        if (sent.code !== 0) throw new Error(sent.stderr.trim())
      }
    })
    event('landed', { url })
    say(`task ${id}: landed ${url}${door === 'one-way' ? ' (one-way)' : ''}`)
    return 0
  })
}

async function resend(id, deps, say) {
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    readTask(folder)
    const events = readEvents(folder)
    const landed = new Set(events.filter((event) => ['prompted', 'for-lead'].includes(event.event)).map((event) => event.detail.id))
    const open = events.findLast((event) => event.event === 'handoff' && !landed.has(event.detail.id))
    if (open === undefined) throw new Refusal(`task ${id} has no hand-off to resend`)
    const { id: hid, start: starts, text, ...extra } = open.detail
    say(`task ${id}: resend ${hid} to the ${open.role}`)
    await tryHandoff(id, folder, hid, { role: open.role, start: starts, text }, deps, extra)
    return 0
  })
}

function appendLine(log, change) {
  writeFileSync(log, `${JSON.stringify(change)}\n`, { flag: 'a' })
}

async function setState(id, state, read, deps, say) {
  if (state === 'blocked' || state === 'stopped')
    throw new Refusal(`task set cannot set ${state}; only task ${state === 'blocked' ? 'ask' : 'stop'} sets it`)
  if (!(state in OWNERS)) throw new Usage(`${state}: not a state`)
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    const { kind } = readTask(folder)
    const last = readLog(folder).at(-1)
    const owner = ownerOf(state, last.to)
    if (owner !== read.as)
      throw new Refusal(`the ${read.as} cannot set ${state}${owner === OWNERS[state] ? '' : ` after ${last.to}`}; the ${owner} sets it`)
    if (!followers(kind, last.to, last.round).includes(state)) throw new Refusal(refusal(id, kind, state, last))
    if (kind === 'spec' && last.to === 'approved') {
      const part = [...readTasks(deps.home).tasks.values()].find((task) => task.slug === id && task.kind === 'part')
      if (part !== undefined) throw new Refusal(`task ${id}: the Part ${part.id} is built from it; the Spec stays approved`)
    }
    // The Reviewer's next pass reads the Lead's reply to each finding of the last pass.
    const pass = readLog(folder).filter((line) => line.to === 'spec' && line.round === 0).length + 1
    if (kind === 'spec' && state === 'spec') {
      if (!existsSync(join(folder, 'reply.md')))
        throw new Refusal(`task ${id}: no reply.md in ${folder}; answer each finding there, then set spec again`)
      renameSync(join(folder, 'reply.md'), join(folder, `reply-${pass}.md`))
    }
    if (kind === 'spec' && state === 'approved' && read.as === 'lead') {
      // A pass is the Reviewer's verdict: `task answer` puts `changes` back as the Lead, and is no pass.
      if (readLog(folder).filter((line) => line.role === 'reviewer' && line.to === 'changes' && line.round === 0).length < 2)
        throw new Refusal(`task ${id}: the Reviewer approves the Spec; the Lead may after two passes with findings, and this is the first`)
      if (!existsSync(join(folder, 'reply.md')))
        throw new Refusal(`task ${id}: no reply.md in ${folder}; answer each open finding there, then set approved again`)
      renameSync(join(folder, 'reply.md'), join(folder, `reply-${pass}.md`))
    }
    // The Lead's `changes` after an approval sends the builder what the Lead's try found, as a report of its own.
    const tried = state === 'changes' && last.to === 'approved'
    if (tried && !existsSync(join(folder, `try-${last.round}.md`)))
      throw new Refusal(`task ${id}: no try-${last.round}.md in ${folder}; write what the try found there, then set changes again`)
    const round = state === 'ready' ? last.round + 1 : last.round
    appendLine(join(folder, 'log.ndjson'), {
      at: deps.now().toISOString(),
      role: read.as,
      from: last.to,
      to: state,
      round,
    })
    say(`task ${id}: ${state} round ${round}`)
    const c = context(id, folder, deps)
    c.tried = tried || (state === 'ready' && existsSync(join(folder, `try-${last.round}.md`)))
    if (state === 'ready') {
      c.tip = git(join(deps.home, 'worktrees', nameOf(id)), ['rev-parse', 'HEAD'])
      c.base = lastTip(folder) ?? c.tip
    }
    const extra = { ...(state === 'ready' ? { tip: c.tip } : {}), ...(read.as === 'lead' ? { quiet: true } : {}) }
    relay(id, await deliver(id, folder, handoffFor({ kind: 'set', to: state }, c), deps, extra), say)
    return 0
  })
}

function lastTip(folder) {
  const marks = readEvents(folder).filter((event) => event.event === 'handoff' && (event.detail.tip ?? event.detail.base) !== undefined)
  const last = marks.at(-1)
  return last?.detail.tip ?? last?.detail.base
}

function refusal(id, kind, state, last) {
  const can = followers(kind, last.to, last.round)
  const after =
    last.to === 'blocked'
      ? 'task answer sets the state from before blocked'
      : last.to === 'stopped'
        ? 'nothing follows stopped'
        : can.length === 0
          ? 'nothing can follow it'
          : `${can.join(', ')} can follow it`
  return `task ${id}: ${state} cannot follow ${last.to}; ${after}`
}

async function ask(id, read, deps, say) {
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    const { kind } = readTask(folder)
    const last = readLog(folder).at(-1)
    if (last.to === 'blocked' || last.to === 'stopped') throw new Refusal(refusal(id, kind, 'blocked', last))
    if (!existsSync(join(folder, 'question.md'))) throw new Refusal(`no question.md in ${folder}; write it first`)
    appendLine(join(folder, 'log.ndjson'), {
      at: deps.now().toISOString(),
      role: read.as,
      from: last.to,
      to: 'blocked',
      round: last.round,
    })
    say(`task ${id}: blocked round ${last.round}`)
    return 0
  })
}

async function answer(id, deps, say) {
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    readTask(folder)
    const last = readLog(folder).at(-1)
    if (last.to !== 'blocked') throw new Refusal(`task ${id} is ${last.to}, not blocked`)
    if (!existsSync(join(folder, 'answer.md'))) throw new Refusal(`no answer.md in ${folder}; write it first`)
    const k = readdirSync(folder).filter((file) => /^question-\d+\.md$/.test(file)).length + 1
    renameSync(join(folder, 'question.md'), join(folder, `question-${k}.md`))
    renameSync(join(folder, 'answer.md'), join(folder, `answer-${k}.md`))
    appendLine(join(folder, 'log.ndjson'), {
      at: deps.now().toISOString(),
      role: 'lead',
      from: 'blocked',
      to: last.from,
      round: last.round,
    })
    say(`task ${id}: ${last.from} round ${last.round}; the answer is answer-${k}.md`)
    if (last.role !== 'lead')
      relay(
        id,
        await deliver(id, folder, handoffFor({ kind: 'answer' }, { ...context(id, folder, deps), k }, last.role), deps, { quiet: true }),
        say,
      )
    return 0
  })
}

async function status(deps, id, say) {
  const { tasks, unreadable } = readTasks(deps.home)
  if (id !== undefined) {
    const bad = unreadable.find((folder) => folder.id === id)
    if (bad !== undefined) throw new Refusal(`${id} unreadable: ${bad.reason}`)
    if (!tasks.has(id)) throw new Refusal(`no task ${id}`)
  }
  const rows = [
    ...[...tasks.values()].map((task) => ({ id: task.id, task })),
    ...unreadable.map((folder) => ({ id: folder.id, reason: folder.reason })),
  ]
    .filter((row) => id === undefined || row.id === id)
    .toSorted((a, b) => a.id.localeCompare(b.id))
  for (const row of rows) {
    if (row.task === undefined) {
      say(`${row.id} unreadable: ${row.reason}`)
      continue
    }
    const { task } = row
    // Each file of the task is read before its first line, so a task that
    // cannot be read shows as one line, as a folder does.
    let events
    let agents
    try {
      events = readEvents(task.folder)
      agents = Object.values(readAgents(task.folder))
    } catch (error) {
      if (id !== undefined) throw new Refusal(`${task.id} unreadable: ${error.message}`)
      say(`${task.id} unreadable: ${error.message}`)
      continue
    }
    say(`${task.id} ${task.state} round ${task.round} (${since(new Date(task.lines.at(-1).at), deps.now())} ago)`)
    for (const agent of agents) {
      if (agent.of !== undefined) {
        say(`  ${agent.role} of the Spec ${agent.of}`)
        continue
      }
      if (RELAYED.includes(agent.runner)) {
        say(`  ${agent.role} ${roleText(agent)}`)
        continue
      }
      if (agent.handle === undefined) {
        say(`  ${agent.role} ${roleText(agent)}, not started`)
        continue
      }
      let state
      try {
        state = (await runnerOf(agent.runner, deps).activity(agent.handle)).state
      } catch (error) {
        say(`  ${agent.role} ${agent.runner} error: ${error.message}`)
        continue
      }
      const record = lastRecord(agent, events, deps.userHome)
      say(`  ${agent.role} ${roleText(agent)} ${state}, last session record ${since(record, deps.now())} ago`)
    }
  }
  return 0
}

function since(from, to) {
  let seconds = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000))
  const parts = []
  for (const [name, size] of [
    ['d', 86_400],
    ['h', 3_600],
    ['m', 60],
  ]) {
    const count = Math.floor(seconds / size)
    seconds %= size
    if (count > 0) parts.push(`${count}${name}`)
  }
  if (parts.length === 0) return `${seconds}s`
  return parts.slice(0, 2).join('')
}

async function stop(id, read, deps, say) {
  if (read.as !== 'lead') throw new Refusal(`the ${read.as} cannot stop a task; the lead stops it`)
  return locked(deps, async () => {
    const folder = folderOf(deps.home, id)
    const record = readTask(folder)
    const last = readLog(folder).at(-1)
    if (last.to === 'stopped') {
      say(`task ${id}: stopped already`)
      return 0
    }
    if (record.kind === 'spec' && !read.force) {
      const running = [...readTasks(deps.home).tasks.values()].find(
        (task) => task.kind === 'part' && task.slug === id && task.state !== 'stopped',
      )
      // Its Parts share its Reviewer, so it goes last.
      if (running !== undefined)
        throw new Refusal(`the Part ${running.id} of the Spec ${id} is not stopped; stop it first, or pass --force`)
    }
    for (const agent of Object.values(readAgents(folder))) {
      // A Part that shares its Spec's Reviewer holds no handle to it: the Reviewer stops with the Spec.
      if (RELAYED.includes(agent.runner) || agent.handle === undefined) continue
      await runnerOf(agent.runner, deps).close(agent.handle)
      appendEvent(folder, { at: deps.now().toISOString(), event: 'closed', role: agent.role })
    }
    for (const path of [join(deps.home, 'worktrees', nameOf(id)), join(deps.home, 'worktrees', `${nameOf(id)}-review`)]) {
      if (existsSync(path)) {
        const done = spawnSync('git', ['worktree', 'remove', ...(read.force ? ['--force'] : []), path], {
          cwd: deps.repo,
          encoding: 'utf8',
        })
        if (done.status !== 0) throw new Refusal(`cannot remove the worktree ${path}: ${(done.stderr || done.stdout).trim()}`)
      } else {
        // A folder that is gone can leave its record in git; prune clears it.
        spawnSync('git', ['worktree', 'prune'], { cwd: deps.repo })
      }
    }
    const branch = record.branch
    if (branch !== undefined && spawnSync('git', ['rev-parse', '--verify', '--quiet', branch], { cwd: deps.repo }).status === 0) {
      if (!read.force) {
        const mergedIntoMain = spawnSync('git', ['merge-base', '--is-ancestor', branch, 'origin/main'], {
          cwd: deps.repo,
        })
        if (mergedIntoMain.status !== 0)
          throw new Refusal(`the branch ${branch} is not merged into origin/main; pass --force to remove it anyway`)
      }
      git(deps.repo, ['branch', '-D', branch])
    }
    if (record.kind === 'spec' && !read.force) built(id, deps, say)
    appendLine(join(folder, 'log.ndjson'), {
      at: deps.now().toISOString(),
      role: 'lead',
      from: last.to,
      to: 'stopped',
      round: last.round,
    })
    say(`task ${id}: stopped round ${last.round}`)
    return 0
  })
}

// Each Part's PR says only its Part, so the Lead marks the Spec built once each Part landed.
function built(slug, deps, say) {
  const parts = [...readTasks(deps.home).tasks.values()].filter((task) => task.kind === 'part' && task.slug === slug)
  const prs = parts.map((task) => readEvents(task.folder).findLast((event) => event.event === 'pr')?.detail.url)
  if (parts.length === 0 || prs.includes(undefined)) say(`task ${slug}: a Part of it did not land, so the Spec is not built`)
  else say(`task ${slug}: each Part landed (${prs.join(', ')}); set the Spec's Status to built`)
}

export async function run(argv, deps) {
  const out = []
  const err = []
  let code
  try {
    code = await command(argv, deps, (line) => out.push(line))
  } catch (error) {
    code = typeof error.exitCode === 'number' ? error.exitCode : error instanceof Usage ? 2 : 1
    err.push(error.message)
  }
  return { code, stdout: out.length === 0 ? '' : `${out.join('\n')}\n`, stderr: err.length === 0 ? '' : `${err.join('\n')}\n` }
}

function exec(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) =>
      resolve({
        code: error === null ? 0 : typeof error.code === 'number' ? error.code : 1,
        stdout,
        stderr: stderr || (error?.message ?? ''),
      }),
    )
  })
}

async function processes() {
  const done = await exec('ps', ['-axo', 'pid=,ppid=,time=,command='])
  return done.stdout
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/))
    .filter((match) => match !== null)
    .map(([, pid, ppid, time, line]) => ({ pid: Number(pid), ppid: Number(ppid), command: line, cpuSeconds: cpuSeconds(time) }))
}

export function cpuSeconds(time) {
  const [days, clock] = time.includes('-') ? time.split('-') : ['0', time]
  return Number(days) * 86_400 + clock.split(':').reduce((sum, part) => sum * 60 + Number(part), 0)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const home = process.env.BINNACLE_HOME ?? join(homedir(), '.binnacle')
  const deps = {
    home,
    repo: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'),
    env: process.env,
    userHome: homedir(),
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    processes,
    runners: {
      herdr: makeHerdr({ exec }),
      headless: makeHeadless({
        home,
        spawnSupervisor(script, dir) {
          spawn(process.execPath, [script, dir], { detached: true, stdio: 'ignore' }).unref()
        },
        kill(pid, signal) {
          try {
            process.kill(pid, signal)
          } catch {
            // Gone already.
          }
        },
        now: () => new Date(),
      }),
    },
  }
  deps.gh = (args, input) =>
    new Promise((resolve) => {
      const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (data) => (stdout += data))
      child.stderr.on('data', (data) => (stderr += data))
      child.on('error', (error) => resolve({ code: 127, stdout, stderr: error.message }))
      child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
      child.stdin.end(input ?? '')
    })
  const done = await run(process.argv.slice(2), deps)
  process.stdout.write(done.stdout)
  process.stderr.write(done.stderr)
  process.exitCode = done.code
}
