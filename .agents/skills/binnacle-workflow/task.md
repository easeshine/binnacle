# The Task tool: its folders, states and Hand-offs

The Lead, the Implementer and the Reviewer share this page. The Task tool, `pnpm task`, holds the state of each Spec and each Part, starts the agents that it can start, and sends each Hand-off.

A **Task** is a Spec, named by its slug, such as `cards`, or a Part of it, named `<slug>/<k>`, such as `cards/2`. A Spec in a folder of its Intent's has a slug with a slash, such as `palette/fill`, for `intents/palette/fill/spec.md`, and its Part is `palette/fill/1`. A name in a slug is never only digits. Each slash is a dot in the Task's folder, and a dash in its worktree and its branch: `palette.fill.1`, `palette-fill-1`. `<k>` is the Part's number under the Spec's **Parts of the build**. A Spec has only Round 0. A Part begins where its Spec's Round 0 ended, and its Rounds start at 1.

## Folders

| Path | Holds | Made by |
|---|---|---|
| `~/.binnacle/worktrees/<slug>-<k>` | The builder's worktree, on the branch `task/<slug>-<k>` | `task build` |
| `~/.binnacle/worktrees/<slug>-review` | The Spec Reviewer's checkout, made at `origin/main`. It reviews each Part of the Spec here too. Before each Round, it moves to the tip that its prompt names. | `task start` |
| `~/.binnacle/worktrees/<slug>-<k>-review` | The checkout of a Reviewer of the Part's own | `task build --reviewer` or `--fresh-reviewer` |
| `~/.binnacle/tasks/<slug>/`, `~/.binnacle/tasks/<slug>.<k>/` | The files of the Spec, or of the Part, below | `task start`, `task build` |

The files of a Task:

| File | Holds | Written by |
|---|---|---|
| `task.json` | What does not change: the id, the kind (`spec` or `part`), the slug, a Part's number, branch and worktree, whether its builder and Reviewer share a family, and the time it was made | the Task tool |
| `log.ndjson` | One JSON line for each change of state: the time, the role, the state before, the state after and the Round | the Task tool |
| `events.ndjson` | One JSON line for each event that is not a change of state: a Hand-off, a start, a stall | the Task tool |
| `agents.json` | The builder and the Reviewer that were chosen, and how to reach each agent once it starts. The Reviewer never reads it. | the Task tool |
| `agents/<role>/` | The agent's session folder, and for a headless agent its queue, its run and its output | the Task tool, and the agent's tool |
| `question.md` | The open question | the role that asks |
| `answer.md` | The answer | the Lead |
| `reply.md` | The Lead's answer to each finding of the last pass of Round 0. `task set <slug> spec` renames it `reply-<p>.md`, and so does the Lead's `task set <slug> approved`. | the Lead |
| `review-<r>.md` | The report of Round `<r>`. Round 0 has passes: its first pass is `review-0.md`, and pass `<p>` is `review-0-<p>.md`. The prompt names the file. | the Reviewer |
| `try-<r>.md` | What the Lead's try of approved Round `<r>` found, with each finding written as a review report writes it. `task set <slug>/<k> changes` needs it. | the Lead |
| `checked.md` | Optional: what the builder checked by hand, which `task land` puts in the PR | the builder |
| `message.md` | The final commit message, which names no model | the builder |
| `pr.md` | The PR's **Summary**, **Evidence**, and **Merge danger** without the Door, as the `pr` skill says | the builder |

The log governs the state: its last line is the current state and Round. If the log does not end with a newline, or a line is not JSON, each command for that Task refuses and names the file. The Lead repairs it by hand.

## Commands

| Command | Role | Does |
|---|---|---|
| `pnpm task start <slug> [--reviewer <role>]` | Lead | Makes the Reviewer's checkout and the Spec's folder. Starts the Reviewer, and sends it Round 0 of `intents/<slug>/spec.md`, as the Lead's checkout holds it. |
| `pnpm task build <slug>/<k> [--by <role>] [--reviewer <role> \| --fresh-reviewer] [--same-family]` | Lead | After Round 0 is `approved`, and the Spec is on `origin/main`, checks the families, makes the branch, the worktree and the Part's folder, and sends the builder the Part |
| `pnpm task set <task> <state>` | the role that owns the state | Sets `spec`, `building`, `ready`, `changes` or `approved`, as the table below allows, and sends its Hand-off |
| `pnpm task ask <task>` | any role | Sets `blocked` |
| `pnpm task answer <task>` | Lead | Sets the state from before `blocked`, and sends the answer to the role that asked |
| `pnpm task resend <task>` | Lead | Sends the newest Hand-off that did not land again, and starts its agent first if it is not running |
| `pnpm task status [<task>]` | any role | Shows the Tasks, and each agent with the time since its session last changed |
| `pnpm task watch` | Lead | Exits when the Lead must act |
| `pnpm task land <slug>/<k>` | Lead | After a Round of the Part is `approved`, squashes the branch with `message.md` and its trailers, pushes it, and opens the PR |
| `pnpm task stop <task> [--force]` | Lead | Closes the agents, removes the worktrees and the branch, and sets `stopped` |

- An agent runs the tool of the main checkout, as its prompt names it: `pnpm -C <main checkout> task ...`. Its own checkout can hold another version of the tool.
- Each agent that the tool starts gets `BINNACLE_TASK` and `BINNACLE_ROLE` in its environment. It leaves out the Task and `--as`: `pnpm -C <main checkout> task set ready`. A subagent has no such environment, so its prompt names both.
- The Lead, outside an agent, passes `--as <role>` when it acts for a role. A command without `--as` acts as the Lead.
- `task set` refuses `blocked` and `stopped`: only `task ask` and `task stop` set them.
- A command whose change of state stays, but whose Hand-off failed, exits 3. Run `pnpm task resend <task>`.
- Each command that writes takes the lock `~/.binnacle/tasks/.lock`, and the watch takes `~/.binnacle/tasks/watch.pid`. If a command exits 1 and names one, check that the process it names is gone, then remove the file by hand.

## Roles

A **role** is `<runner>:<tool>:<model>@<thinking>`:

| Runner | Starts the agent | Tools |
|---|---|---|
| `herdr` | the Task tool, in a herdr tab of its own | `claude`, `codex`, `pi` |
| `headless` | the Task tool, as one run of `claude -p`, `codex exec` or `pi -p` for each prompt, under a supervisor | `claude`, `codex`, `pi` |
| `subagent:<model>@<thinking>` | the Lead, with the prompt that the tool prints | the Lead's own |
| `lead` | no one: the Lead builds the Part itself | the Lead's own |

`.agents/roles.json` holds the Maintainer's roles, and the family of each provider. A person's own `~/.binnacle/roles.json` replaces a role, and its `default` replaces every role it does not name. `lead` names the Lead's tool and model, such as `"lead": "claude:opus"`, so that `--by lead` has a family.

- An agent started again continues its session: pi from its session folder, claude from its session's UUID, and codex from the newest session in its checkout.
- A Part's Reviewer is its Spec's own agent, in the Spec's checkout. The Part's `agents.json` holds `{ "of": "<slug>" }`.
- `--reviewer` gives the Part a Reviewer of its own. `--fresh-reviewer` does too, and starts it from a copy of the Spec Reviewer's newest pi session. It forks only pi in herdr.
- The tool starts a Part's own Reviewer at its first `ready`, so that prompt also tells it its role.
- The family of a role comes from its tool: `claude` is anthropic, `codex` is openai, and pi's is its provider's, through `families`. A subagent's comes from its model's name.
- With two families or more among the roles, `task build` refuses a builder and a Reviewer of one family, unless it gets `--same-family`. With one family only, it takes them, and the trailer and the PR say so.
- A Spec stops after its Parts: `task stop <slug>` refuses while a Part of it is not stopped, unless it gets `--force`.
- An approved Spec goes back to `spec`, for another pass of Round 0, until a Part of it is built.

## States

| State | Set by | After | Hand-off |
|---|---|---|---|
| `spec` | Lead, or `task start` as a Spec's first line | `changes` and `approved` at Round 0, on a Spec | sends the Reviewer its next pass, with `reply-<p>.md` |
| `changes` | Reviewer, or the Lead after `approved` on a Part | `spec`, `ready`, and `approved` after Round 0 on a Part | on a Spec, wakes the Lead to edit the Spec. On a Part, sends the report to the Implementer: the Lead's `try-<r>.md` after `approved`. The Round stays, and the next Round checks the try's findings first. |
| `approved` | Reviewer; the Lead on a Spec after two passes with findings, with `reply.md`; or `task build` as a Part's first line | `spec`, `ready`, and `changes` at Round 0 on a Spec | on a Spec, wakes the Lead. On a Part, also asks the Implementer for `message.md` and `pr.md`. |
| `building` | Implementer | `approved` at Round 0, and `changes`, on a Part | nothing |
| `ready` | Implementer | `building`, and `changes` on a Part | sends the Reviewer the tip, and the commits since the last Round |
| `blocked` | any role, with `task ask` | each state except `blocked` and `stopped` | wakes the Lead |
| `stopped` | Lead, with `task stop` | each state except `stopped` | nothing: the Task is done |

- `building` marks progress. Continue to work after you set it.
- Each other state hands the Task on. End your turn after you set it.
- Each `ready` starts the next Round. The Round number goes up by one.
- A change that the Lead sets never wakes the Lead.

## The watch

`pnpm task watch` prints one line for the oldest thing that the Lead must act on, and exits:

| Line | Means |
|---|---|
| `cards/2 approved round 1 (reviewer)` | A change of state that wakes the Lead |
| `cards/2 implementer (subagent): <prompt>` | A Hand-off to a role that the Lead relays, with its prompt |
| `cards/2 reviewer hand-off h3 failed: <error>` | The agent did not start, or the prompt did not land |
| `cards/2 reviewer hand-off h3 was not sent; run task resend cards/2` | A command stopped during its Hand-off |
| `cards/2 implementer stalled: no session record for 20 min` | The agent works, but its session did not change for 20 minutes |
| `cards/2 implementer stalled: ...; busy 48370 node ..., cpu 4:50 in 5 min` | A process under the agent used the CPU for at least 4 of the last 5 minutes |
| `cards/2 implementer waits in its pane` | The agent waits for a person in its herdr pane |
| `cards/2 reviewer run timed out after 45 min` | A headless run hit its time limit, and was stopped with its children |
| `cards/2 reviewer run failed: spawn pi ENOENT` | A headless run could not start. Fix the cause, then send the prompt again by hand. |

A tool writes its session when a message ends, not while it streams, so a long message can show as a stall. Read the pane, or the busy process, before you act. The tool stops no agent by itself.

## Questions

1. Write your question to `question.md` in the Task folder.
2. Run `pnpm task ask <task>`.
3. When your prompt tells you that `answer-<k>.md` exists, read it, and continue from the state you had. The Lead set that state again, so do not set it yourself.

The Lead answers:

1. Write the answer to `answer.md` in the Task folder.
2. Run `pnpm task answer <task>`. The tool renames both files to `question-<k>.md` and `answer-<k>.md`, and sends the answer to the role that asked.

## The PR

`pnpm task land <slug>/<k>` checks each input before it changes anything, then:

1. squashes the branch into one commit on `origin/main`, with `message.md` as its message and two trailers, `Built-by:` and `Reviewed-by:`, and pushes it;
2. opens the PR: where the Part fits ("Part 2 of 3 of the Spec *cards*"), then `pr.md` with the Door in its **Merge danger**, then **Checked**: the review, the Part's text, `checked.md` if it exists, and the records to check;
3. labels a one-way PR `one-way`;
4. posts each review report of the Part, and each `try-<r>.md`, as a comment of its own, oldest first;
5. writes `landed` with the PR's address.

A land that stops part of the way names the step: run it again, and it finishes without a second commit, PR or comment. If the branch does not hold `origin/main`, `task land` refuses: the builder rebases it, as `implementer.md` says.
