# AGENTS.md

binnacle is a terminal app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). What it is, and why, is [its Intent](intents/binnacle/intent.md).

Read [`CODING-STANDARD.md`](CODING-STANDARD.md) before you write a file that is committed.

## Where things are

```text
intents/<slug>/intent.md    what is wanted and why, in the Maintainer's words: the product, or one feature
intents/<slug>/spec.md      the design of one feature, beside its Intent, until it is built
apps/docs/                  the docs website
packages/binnacle/          the app: a dsh bundle, its core and its plugins
tools/oxlint/anti-slop/     binnacle's own lint rules, from anti-slop
packages/binnacle/docs/     the docs for a person (use/) and an author (author/), and the glossary. The website shows them, and the package carries them
packages/binnacle/skills/   the skill that the package gives an author's agent
packages/binnacle/src/**/AGENTS.md  how the code beside it is built so far: the second source, after the code
adr/                        the decisions that bind more than one change
.agents/skills/             the shared skills, and the scripts that a skill runs
.agents/roles.json          the Maintainer's roles for the agents of a fix or a Task, which .agents/roles.mjs reads
.agents/doors.md            what makes a PR one-way
references.json             the repositories that pnpm refs fetches into .refs/
.refs/<name>/               each Reference at its pin, to read and never to write
```

## The workflow's words

Each is capitalized wherever it is used in this meaning. binnacle's own words are in [`packages/binnacle/docs/glossary.md`](packages/binnacle/docs/glossary.md).

- **Maintainer**: the person who grills with the agents, approves Intents, tries what is merged, and publishes.
- **Intent**: what is wanted and why, in the Maintainer's plain words, in `intents/<slug>/intent.md`. The product's Intent holds the Stages; a feature's Intent holds what is wanted of one feature. It holds no design.
- **Stage**: a part of an Intent that ends in a behaviour the Maintainer can try under dsh.
- **Spec**: the design of one feature of a Stage, in `intents/<slug>/spec.md` beside its Intent: its behaviours, its seams, its decisions and the parts it is built in. Its Intent links it. Once it is built, the docs say what it does, and the `AGENTS.md` beside its code says how.
- **Journey**: what a person does with a feature in a real session, from start to end, as a Spec writes it. It crosses several behaviours, and the features beside them.
- **ADR**: a decision that binds more than one change, in `adr/`, written once the Maintainer picks it.
- **Reference**: another repository, fetched at its pin into `.refs/`, to read and never to write. [`CODING-STANDARD.md`](CODING-STANDARD.md) says how to use one.
- **Fix**: a small change for one issue, built by one agent and reviewed by an agent of another model family when one is set up, as the `fix` skill says.
- **Lead**: the agent that runs the `binnacle-workflow` skill with the Maintainer: it writes a Spec, starts each Task, and checks what comes back.
- **Part**: one numbered item under a Spec's **Parts of the build**: a vertical slice, built on one branch and merged in one PR.
- **Task**: a Spec or a Part, while `pnpm task` holds its state.
- **Implementer** and **Reviewer**: the roles that build a Part and review it. The review is blind, and of another model family when one is set up.
- **Door**: whether a PR is one-way or two-way, as `.agents/doors.md` says.
- **Round**: one review of a Task. Round 0 reviews the Spec. Each later Round reviews the Part's diff.

Before you change code, read the `AGENTS.md` of its folder. A change edits, in the same commit, that `AGENTS.md`, and each page of `packages/binnacle/docs/` that says what the change touches: what a person can do in `use/`, and what an author can change in `author/`. A new row goes in the table of features in `use/index.md`, and in the table of built-ins in `author/index.md`. A PR that changes the published package adds a changeset with a short release note: before 1.0, a fix or a feature is a `patch`, and a break of what an author may import is a `minor`. The Maintainer merges the version PR to publish. The dsh workflow opens a PR that widens binnacle's range of dsh when its checks pass on a new dsh; `scripts/dsh-widen.mjs` makes the change, and `scripts/dsh-pin.test.mjs` holds the Reference, the tests' dsh and the peers together. A concept that is ours, and that could be read two ways, goes in its glossary in the same commit: `packages/binnacle/docs/glossary.md`, or the list above, capitalized there and wherever it is used in that meaning.

## Commands

| Command | Does |
|---|---|
| `vp install && pnpm refs` | Installs, and fetches each Reference into `.refs/` |
| `vp run ready` | Formats and lints with types, then runs every test and every build. CI runs it on each PR. |
| `vp check --fix` | Formats the tree and fixes what lint can |
| `vp run @easeshine/binnacle#build` | Builds the bundle and its command. `node packages/binnacle/dist/cli.mjs` then links `packages/binnacle` into binnacle's dsh profile and starts it. |
| `vp run @easeshine/binnacle#test` | Runs the package's tests |
| `vp run dev` | Runs the docs website |
| `pnpm review --as <tool>:<model>` | Starts a reviewer of another model family on the branch's tip, as the `fix` skill says |
| `pnpm task <command>` | The Task tool of the `binnacle-workflow` skill |
