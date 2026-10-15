---
name: fix
description: Fix one small issue from GitHub, a bug or a gap, from the issue to the PR, with a review by another model. Use when you are asked to fix an issue, or to close a gap.
---

# Fix

A fix is one small change for one issue, built by you and reviewed by an agent of another model family. A review is at most two Rounds. A larger change goes to the `binnacle-workflow` skill, which the Maintainer starts.

## Is it small

A fix is small when a reviewer can hold all of it in one read, and the Maintainer can take it back with one revert. Check each item before you build, and again before each commit. If one fails, stop, and tell the Maintainer which one, and why: the change goes to `binnacle-workflow`.

- **One behaviour.** The issue names one behaviour that is wrong or missing, and one test can show it.
- **No open decision.** The issue, the Intents, the Specs and the ADRs answer each choice that the change meets. A choice between two designs, or a question that the review puts under **Questions** about scope, is open.
- **Two-way.** Its Door is two-way, as [`.agents/doors.md`](../../doors.md) says.
- **One place.** It changes two source files at most, under one `AGENTS.md`. Tests and records do not count.

## Steps

1. Read the issue with `gh issue view <n>`, and its comments.
2. Make a worktree on the branch `fix/<n>-<slug>`, from `origin/main`: `git worktree add ~/.binnacle/worktrees/fix-<n> -b fix/<n>-<slug> origin/main`.
3. Read the `AGENTS.md` of each folder that you change.
4. If the issue says that a behaviour is wrong, show it fail first, with a test.
5. Build the change with the `tdd` skill. Done when each behaviour of the issue has a test that failed before the change.
6. Change the records in the same commit, as the root `AGENTS.md` says: the `AGENTS.md` beside the code, the docs, and a changeset.
7. Run `vp run ready`.
8. Commit. The message is Conventional Commits, and it ends with `Closes #<n>`.
9. Run `pnpm review --as <tool>:<model>`, with your own tool and model, such as `--as claude:opus`. It picks a reviewer of another family, and waits for its report.
10. If the reviewer runs as a subagent, `pnpm review` prints its prompt. Start the subagent with it, in the background, and save its final message where `pnpm review` says.
11. If the verdict is `changes`, fix each finding of **Source** and **Standard**, then commit, and go back to step 7.
12. If the second Round ends with `changes`, stop the Rounds. List each open finding in the PR.
13. Push the branch. Write the PR's body with the `pr` skill, and open the PR with `gh pr create --body-file`.
14. Post each report as a comment of its own, oldest first: `gh pr comment <pr> --body-file <report>`.
15. Tell the Maintainer the PR. The Maintainer merges it.
16. After it merges or closes, remove both checkouts: `git worktree remove ~/.binnacle/worktrees/fix-<n>`, and `git worktree remove ~/.binnacle/reviews/fix-<n>-<slug>/checkout`.

## The PR

- Its title says what a person or an author can do now.
- Its **Checked** names the reviewer with the `Reviewed-by:` line that `pnpm review` printed. When that line says the builder's family, the Maintainer reads the diff with more care.
- It quotes each question that a report put under **Questions**, for the Maintainer to answer.
- It ends with `Closes #<n>`.

## The reviewer

`pnpm review` takes the roles from `.agents/roles.json`. A person's own `~/.binnacle/roles.json` replaces them: `{ "default": "subagent:sonnet" }` makes every role a Claude subagent, and one agent then does each part. `--reviewer <role>` names one reviewer for this Round, such as `--reviewer headless:codex:gpt-6.1-sol@high`.

A role is `<runner>:<tool>:<model>@<thinking>`:

- `headless` runs `claude -p`, `codex exec` or `pi -p` in a checkout of its own, under `~/.binnacle/reviews/<branch>/`;
- `subagent:<model>` is a subagent that you start, with the prompt that `pnpm review` prints.
