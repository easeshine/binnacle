---
name: binnacle-workflow
description: The Lead's flow for a large change, from an Intent to a Spec with Parts, each built and reviewed blind by agents that the Task tool starts, to the Maintainer's try.
disable-model-invocation: true
---

# The binnacle workflow

You are the **Lead**. You turn what the Maintainer wants into a Spec, start each Task, answer its questions, and check what comes back. You hold at most three things in flight, such as one build, one review and one fix.

The Maintainer grills with you, approves each Intent, tries what is merged, and publishes. You decide the rest: each Spec, its design and its Parts, each role, each answer to a finding, and each merge. A Spec is for the Implementer and the Reviewer: the Maintainer does not read it.

A small change is not for this flow: a change that passes *Is it small* of the `fix` skill goes to that skill.

The Task tool's folders, states and commands are in [`task.md`](task.md). Read it before your first command.

## From Intent to Spec

1. Grill the Maintainer about the feature with the `grill` skill, until both of you agree on what is wanted.
2. Write `intents/<slug>/intent.md` in the Maintainer's words: the title, the metadata, Problem, Proposed outcome, Affected users and systems, Constraints, and Open questions. It holds no design.
3. Change the Intent until the Maintainer approves it. Each open question is answered by an edit to the Intent.
4. Write `intents/<slug>/spec.md`, as [`writing-a-spec.md`](writing-a-spec.md) says. An Intent with several Specs, such as one for each Stage, holds each in a folder of its own, `intents/<slug>/<name>/spec.md`, with the Task `<slug>/<name>`.
5. Drive each Journey of the Spec under dsh on `main`, as *A try* says, as far as binnacle goes now.
6. Find each step where binnacle draws other than the Journey says, though no behaviour changes it.
7. Correct the Spec at each step that you found.
8. Run `pnpm task start <slug>`, with the Reviewer of *Roles* below. It sends the Reviewer Round 0.
9. Run `pnpm task watch` in the background. When it exits, act on its line, then run it again.
10. For each pass with findings, edit the Spec, and write `reply.md` in the Spec's Task folder: your answer to each finding.
11. After the first pass with findings, run `pnpm task set <slug> spec`.
12. After each later pass with findings, decide each finding that is still open. Correct the Spec, or add the finding to the text of the Part that it falls in.
13. Write each decision in `reply.md`.
14. Run `pnpm task set <slug> approved`. If a finding changes the design, run `pnpm task set <slug> spec` in its place, for one more pass.
15. Answer each finding against the Intent as it was approved. Where the Intent cannot hold as written, or leaves a gap, decide, write the decision under **Decisions**, and file an issue with the label `gap` that names it, so the Maintainer can change the Intent.
16. When Round 0 is `approved`, open a PR of the Spec, with the Status `agreed`: `docs: the Spec of <feature>`. Merge it when its checks pass, then build the Parts: a Part is built only from a Spec that `origin/main` holds.

## Each Part

1. For each Part whose earlier Parts are merged, run `pnpm task build <slug>/<k>`, with the builder of *Roles* below.
2. If a command exits 3, or the watch says that a Hand-off failed or was not sent, run `pnpm task resend <task>`.
3. If the watch reports a stall, read the pane or the busy process first. Decide what to do: the tool stops no agent.
4. If the watch prints a prompt for a subagent, start the subagent with it, in the background. For each later prompt to that role of that Task, continue the same subagent.
5. If a subagent Reviewer gives its report as its final message, write it to the file that its prompt names, then set its state with `--as reviewer`.
6. Read each review report in full.
7. After the third Round with findings, choose one narrow Round more, or stop and ask the Maintainer.
8. If the Part changes what binnacle draws or boots, try its branch, as *A try* says, and write what you drove and what it drew in `checked.md`.
9. If the try finds a bug, write it as a finding in `try-<r>.md`, in the form of a review report.
10. If you wrote `try-<r>.md`, run `pnpm task set <slug>/<k> changes`. The builder fixes it, and the next Round reviews the fix.
11. After the next approval, try the branch again. Stop when the try finds no bug.
12. Run `pnpm task land <slug>/<k>` to open the PR, and merge it when its checks pass.
13. If `task land` says that the branch does not hold `origin/main`, send the Part back to its builder to rebase. Rebase it yourself only when you built it.
14. After the PR merges or closes, run `pnpm task stop <slug>/<k>`.
15. After the last Part merges, hand the Maintainer the try, as *The Maintainer's try* says. The last Part's PR set the Spec's Status `built`, and its row in the Intent's list of Specs. If it did not, set them in a PR of your own.
16. When the try's fixes and ADRs merge, run `pnpm task stop <slug>`.

## The workflow's own issues

When a skill, a script of the Task tool or the setup slows a Task, or lets a mistake through, file an issue with the label `workflow`, in the shape of `.github/ISSUE_TEMPLATE/workflow.yml`. File it when you meet it, or at the latest after the Maintainer's try. Examples: an agent's run that fails and wakes nobody, a step that the Maintainer must do for you, and a mistake of a Spec that Round 0 passed. Say what it cost, and the change that you want. Such an issue is not a problem of binnacle, so it never takes the label `bug` or `gap`.

## Roles

The Maintainer names the role of each agent at the start of a session, or before a builder starts. For example: "a Claude subagent builds, pi on gpt-6.1-sol reviews". With no name, take the roles in `.agents/roles.json` and `~/.binnacle/roles.json` without asking.

| The Maintainer names | Pass |
|---|---|
| you, as the builder | `task build <slug>/<k> --by lead` |
| a subagent | `--by subagent:<model>`, or `--reviewer subagent:<model>` |
| an agent in a pane | `--by herdr:<tool>:<model>`, such as `herdr:pi:zai/glm-5.3@max` |
| an agent with no pane | `--by headless:<tool>:<model>`, such as `headless:codex:gpt-6.1-sol@high` |

- The builder and the Reviewer are of different families when two are set up. The tool refuses one family for both, unless the Maintainer asks for `--same-family`.
- A person with one agent sets one default role, such as `{ "default": "subagent:sonnet", "lead": "claude:opus" }`. The tool then takes one family for both roles, and the PR says so.
- The review is blind. Give the Reviewer only the prompts that the tool prints. Never name the builder to the Reviewer.

## A try

1. In the Part's worktree, run `vp install`, then `vp run @easeshine/binnacle#build`.
2. Run `node packages/binnacle/dist/cli.mjs` there once. It links that checkout into the `binnacle` dsh profile.
3. Drive dsh in a herdr pane, as the `author-trial` skill's `driving.md` says.
4. When you are done, run `node packages/binnacle/dist/cli.mjs` in the main checkout. It links the profile back.

## The Maintainer's try

1. Pull `main`, run `vp install` and `vp run @easeshine/binnacle#build`, then run `node packages/binnacle/dist/cli.mjs` once, so that the `binnacle` profile runs what merged.
2. Tell the Maintainer what to try: `binnacle`, then each Journey of the Spec, and what each one should draw.
3. List the candidate ADRs: each decision of the Spec that binds more than one change, in one line each. An ADR records why: the reasons and the options that lost. The decisions of one Intent go in one ADR.
4. File each problem that the Maintainer finds as an issue, for the `fix` skill, with the label of its template in `.github/ISSUE_TEMPLATE/`: `bug` or `gap`. If one is too large for a fix, or the Intent was wrong, grill again.
5. Write each ADR that the Maintainer picks, in a PR of its own.

## Before you end a session

- Each Task in flight has its state in the Task tool: `pnpm task status` shows each one.
- Each subagent in flight has ended its turn, and its Task is in a state that the tool holds.
- Each try that you handed the Maintainer has its answer: its issues filed, and its ADRs written.
- Each problem of the workflow that you met in the session is filed, with the label `workflow`.
- If the Maintainer asks for it, the `handoff` skill writes what the next Lead needs.
