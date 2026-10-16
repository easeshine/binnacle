export function reportFile(round, pass) {
  if (round > 0) return `review-${round}.md`
  return pass <= 1 ? 'review-0.md' : `review-0-${pass}.md`
}

const ROLES = '.agents/skills/binnacle-workflow'

export function handoffFor(change, c, asker) {
  const report = `${c.folder}/${reportFile(c.round, c.pass)}`
  // The tool of the main checkout: the agent's own checkout may hold another version of it.
  const tool = `pnpm -C ${c.repo} task`
  const reviewer = `You are the Reviewer. Read ${c.repo}/${ROLES}/reviewer.md first.`
  const verdict = `Write the report to ${report}, then set the state with \`${tool} set ${c.id} changes --as reviewer\` or \`${tool} set ${c.id} approved --as reviewer\`, and end your turn. If you cannot write the file, give the report as your final message, and the Lead writes it.`
  const spec = `${c.repo}/intents/${c.slug}/spec.md`
  // The Lead's try of an approved Round: the Implementer fixes what it found, and the next Round checks each of its findings first.
  const tried = `${c.folder}/try-${c.round - (change.to === 'ready' ? 1 : 0)}.md`
  const lastFindings =
    c.tried === true ? `each finding of the Lead's try of the last Round first, in ${tried}` : 'each finding of the last Round first'
  switch (change.kind) {
    case 'start':
      return {
        role: 'reviewer',
        start: true,
        text: `${reviewer} Round 0 of the Spec ${c.id}: check the Spec only, ${spec}, and its Intent beside it. ${verdict}`,
      }
    case 'build':
      return {
        role: 'implementer',
        start: true,
        text: `You are the Implementer. Read ${c.repo}/${ROLES}/implementer.md first. Build Part ${c.part} of the Spec intents/${c.slug}/spec.md in ${c.worktree}, on the branch ${c.branch}. Round 0 of the Spec is approved. Your task folder is ${c.folder}. Set your state with \`${tool} set ${c.id} <state> --as implementer\`.`,
      }
    case 'answer':
      return {
        role: asker,
        start: false,
        text: `The Lead answered your question of ${c.id}: read ${c.folder}/answer-${c.k}.md, and continue from the state you had. The Lead set that state again, so do not set it yourself.`,
      }
    case 'set':
      switch (change.to) {
        case 'spec':
          return {
            role: 'reviewer',
            start: false,
            text: `Round 0, pass ${c.pass} of ${c.id}: the Lead edited the Spec, ${spec}, and ${c.folder}/reply-${c.pass}.md answers each finding of the last pass. Check each finding of the last pass first, marked fixed or still open, then what the edits touched. ${verdict}`,
          }
        case 'ready':
          return {
            role: 'reviewer',
            start: false,
            // A Part's own Reviewer starts at its Round 1, so that prompt is its first. The Spec's Reviewer knows its role already.
            text: `${c.round === 1 && c.sharedReviewer !== true ? `${reviewer} ` : ''}Round ${c.round} of Part ${c.part} of the Spec ${c.slug} at ${c.tip}: the commits ${c.base}..${c.tip}. In your checkout ${c.review}, run \`git switch --detach ${c.tip}\`, then \`vp install\`. ${c.round > 1 ? `Check ${lastFindings}, then what the commits touched.` : `Review the commits against Part ${c.part} of the Spec intents/${c.slug}/spec.md, as the \`review\` skill says.`} ${verdict}`,
          }
        case 'changes':
          return c.round === 0
            ? undefined
            : {
                role: 'implementer',
                start: false,
                text: `${c.tried === true ? "The Lead's try of " : ''}Round ${c.round} of ${c.id} has findings: read ${c.tried === true ? tried : report} in full, fix each finding, and set \`ready\` again with \`${tool} set ${c.id} ready --as implementer\`.`,
              }
        case 'approved':
          return c.round === 0
            ? undefined
            : {
                role: 'implementer',
                start: false,
                text: `Round ${c.round} of ${c.id} is approved. Write ${c.folder}/message.md and ${c.folder}/pr.md, as implementer.md says, and end your turn.`,
              }
        default:
          return undefined
      }
  }
}
