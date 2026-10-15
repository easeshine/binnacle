---
name: handoff
description: Write what the next session needs to continue this session's work.
argument-hint: "What will the next session do?"
disable-model-invocation: true
---

# Handoff

Write the handoff to `~/.binnacle/handoff.md`, outside the checkout, so that it survives a restart. If the Maintainer said what the next session does, write for that.

The handoff holds only what no record holds. It links the rest: the Intents, the Specs, the issues, the branches, the PRs and the Task folders in `~/.binnacle/tasks/`.

## Sections

- **Where it stands:** each Task and each fix in flight, with its state, and what fails.
- **Who still works:** each agent that still runs, with its role, its Task, and its runner: a pane, a headless session or a subagent. The next session continues it, and starts no second one.
- **Decided, not recorded:** each decision of this session that is in no Intent, Spec, issue or PR yet.
- **Next:** the first step, and the question for the Maintainer.

## Rules

- Never copy a privacy placeholder into the handoff. Name where the value lives.
- End by giving the Maintainer the file's path and the first line for the next session.
