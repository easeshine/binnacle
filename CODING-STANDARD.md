# Coding standard

These rules apply to every file that is committed, and to issues and PRs. `vp run ready` holds the rules that a machine can check.

## References

- `pnpm refs` fetches each repository in [`references.json`](references.json) into `.refs/<name>`, at its pin. Never write under `.refs/`.
- The source is the authority. `dsh` is the authority on the harness, and `pi` on pi-tui. Read the source before you state a fact about it.
- A committed file cites no Reference path and no issue. Git and GitHub keep the history.
- A home path or a privacy placeholder never goes in a tracked file. A tool's own folder under home, such as `~/.binnacle` or `~/.dsh`, is the same on every machine, so it is allowed. If your tool shows you a value as a placeholder, read the value from where it lives.

## Records

| Record | Home |
|---|---|
| What is wanted, why, and in which Stages | the Intent |
| The design of one feature of a Stage, before it is built | its Spec, `intents/<slug>/spec.md` |
| How a part of the code is built so far | the `AGENTS.md` beside it |
| What a person can do, and what an author can change | the docs, `packages/binnacle/docs/` |
| One change to make | its GitHub issue |
| Why a decision that binds more than one change was taken | an ADR in `adr/` |
| What one change did, and why | its commit message, in Conventional Commits |
| The proof of each test, and where the change fits | its PR |

- Each fact has one home. Everywhere else links to it.
- An ADR stands on its own. It cites nothing, and it links only other ADRs.
- An ADR holds the decision, its reasons, the options that lost, and what follows. It holds no design: no file, no function, and no step of a build.

## Prose

- All prose follows [`STE.md`](STE.md).
- A document that agents load also follows the `writing-for-agents` skill.
- Use the owner's word: dsh's, Cordis's or pi-tui's. Make a new word only when no owner has one.

## Comments

- Write no comment by default. Names and types are the documentation.
- Write a comment only for what the code cannot say: a reason that is not obvious, a rule that must stay true, or a surprising edge case.
- A comment says why. It never says what the code does.
- A file has no header comment, unless it holds a reason of this kind.
- A test needs no comment: its name says the behaviour.
- A type assertion in `packages/binnacle/src/` has a comment above it that says why it is safe, except `as const`. Remove the assertion when you can. `vp lint` holds this rule.
- Never assert through `unknown`, as in `x as unknown as T`. `vp lint` holds this rule in every file.
