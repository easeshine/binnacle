---
name: retro
description: Read the sessions and the review reports since the last retro, and put each lesson into the skill, check or record that it changes.
disable-model-invocation: true
---

# Retro

A retro improves the agents' environment: the skills, `AGENTS.md`, `CODING-STANDARD.md`, the checks and the tools. It does not judge the code.

## Steps

1. Load the `writing-for-agents` skill.
2. Find the last retro: the newest commit whose subject starts with `chore(retro)`. List the PRs merged since it: `gh pr list --state merged --search "merged:>=<its date>"`.
3. Read the Lead's sessions since the last retro: the Maintainer's prompts, and the replies to them. A Claude Code session is a `.jsonl` file in `~/.claude/projects/`, in the folder named for the checkout's path, with each character that is not a letter or a digit as `-`.
4. Read the review reports: each Task's in `~/.binnacle/tasks/`, and each fix's in `~/.binnacle/reviews/`.
5. Find the candidates, in the places below.
6. Show the Maintainer the list, most costly first, with the change for each one.
7. For each candidate that the Maintainer accepts, make the change on the branch for skills and docs. Commit with the subject `chore(retro): <what changes>`, so that the next retro starts there.

## Where to look

- **Records:** a fact that an agent read from code because no record holds it.
- **Checks:** a mistake that a script could find. A rule that a machine can check gets a lint rule or a test in `vp run ready`, not a line of prose.
- **Review:** a finding that came late, or a finding that was not a defect.
- **Hand-offs:** a wait with no signal, or a prompt that did not arrive.
- **Runners:** a role whose runner, tool or model did worse than another on the same kind of work.
- **Cost:** a call that read much to answer little.
- **Sediment:** a line in a skill that changes nothing, or that is no longer true.

## Where a change goes

- A rule for every review goes in the `review` skill.
- A rule for one role of a Task goes in that role's file in the `binnacle-workflow` skill.
- A rule for a small fix goes in the `fix` skill.
- `AGENTS.md` gets a line only when every agent needs it.
