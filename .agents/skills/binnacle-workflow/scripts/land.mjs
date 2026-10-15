import { roleText } from '../../../roles.mjs'

function order(name) {
  const [, round, pass] = name.match(/^review-(\d+)(?:-(\d+))?\.md$/)
  return [Number(round), pass === undefined ? 1 : Number(pass)]
}

export function reportsOf(files) {
  return files
    .filter((name) => /^review-\d+(?:-\d+)?\.md$/.test(name))
    .toSorted((a, b) => {
      const [ra, pa] = order(a)
      const [rb, pb] = order(b)
      return ra - rb || pa - pb
    })
}

function who(agent) {
  if (agent.runner === 'lead')
    return agent.lead === undefined ? 'the Lead' : `the Lead, ${[agent.lead.tool, agent.lead.model].filter(Boolean).join(':')}`
  return roleText(agent)
}

// The builder's commits name no model, so the Reviewer does not know who built. The squash names both,
// and says when they are of one family.
export function withTrailers(message, { builder, reviewer, sameFamily }) {
  const trailers = [
    ...(builder === undefined ? [] : [`Built-by: ${who(builder)}`]),
    ...(reviewer === undefined ? [] : [`Reviewed-by: ${who(reviewer)}${sameFamily ? ", the builder's family" : ''}`]),
  ]
  return trailers.length === 0 ? message : `${message.trimEnd()}\n\n${trailers.join('\n')}\n`
}

export function messageOf(message) {
  const [header, ...rest] = message.split('\n')
  return { header: header.trim(), body: rest.join('\n').trim() }
}

export const PR_SECTIONS = ['Summary', 'Evidence', 'Merge danger']

// The builder writes `pr.md` with the `pr` skill. The tool knows the rest: where the Part fits,
// its Door, the review, and the Part itself.
export function prBody({ message, pr, part, door, checked, reports, place, sameFamily }) {
  const kept = messageOf(message)
    .body.split('\n')
    .filter((line) => /^(Author API:|Closes #|Fixes #)/.test(line))
  return [
    `Part ${place.k} of ${place.of} of the Spec *${place.title}*, \`${place.file}\`.`,
    '',
    pr.trim().replace(/^## Merge danger\n\n/m, `## Merge danger\n\n**Door:** ${door}.\n\n`),
    '',
    '## Checked',
    '',
    `**Review:** ${reports.length} report${reports.length === 1 ? '' : 's'}, each in a comment below, oldest first.${sameFamily ? " The reviewer is of the builder's family: read the diff with more care." : ''}`,
    '',
    '<details><summary>The Part</summary>',
    '',
    part.trim(),
    '',
    '</details>',
    '',
    ...(checked === undefined ? [] : ['<details><summary>What the builder checked</summary>', '', checked.trim(), '', '</details>', '']),
    '- [ ] The `AGENTS.md` beside the code, and each page of `packages/binnacle/docs/` that the change touches',
    '- [ ] A changeset, when the published package changes',
    '- [x] `vp run ready` passes: the Reviewer ran it in each Round.',
    '- [ ] Tried under dsh, if the change draws or boots: what was driven, and what it drew.',
    '',
    ...kept.flatMap((line) => [line, '']),
  ]
    .join('\n')
    .replace(/\n+$/, '\n')
}

export function reportComment(file, text) {
  return `${marker(file)}\n<details><summary>${file}</summary>\n\n${text.trim()}\n\n</details>\n`
}

export function marker(file) {
  return `<!-- binnacle-report: ${file} -->`
}
