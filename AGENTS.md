# AGENTS.md

binnacle is a terminal app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). What it is, and why, is [its Intent](intents/binnacle/intent.md).

Read [`CODING-STANDARD.md`](CODING-STANDARD.md) before you write a file that is committed.

## Where things are

```text
intents/<slug>/intent.md    what is wanted and why, in the Maintainer's words: the product, or one feature
apps/docs/                  the docs website
packages/binnacle/          the app: a dsh bundle, its core and its plugins
tools/oxlint/anti-slop/     binnacle's own lint rules, from anti-slop
docs/adr/                   the decisions that bind more than one change
docs/glossary.md            binnacle's words, for a person and an author
docs/features.md            the index of features, their docs and their rows
docs/features/<feature>.md  how a feature is built so far: the second source, after the code
.agents/skills/             the shared skills
references.json             the repositories that pnpm refs fetches into .refs/
.refs/<name>/               each Reference at its pin, to read and never to write
```

## The workflow's words

Each is capitalized wherever it is used in this meaning. binnacle's own words are in [`docs/glossary.md`](docs/glossary.md).

- **Maintainer**: the person who grills with the agents, approves Intents, tries what is merged, and publishes.
- **Intent**: what is wanted and why, in the Maintainer's plain words, in `intents/<slug>/intent.md`. The product's Intent holds the Stages; a feature's Intent holds what is wanted of one feature. It holds no design.
- **Stage**: a part of an Intent that ends in a behaviour the Maintainer can try under dsh.
- **Spec**: the design of one feature of a Stage: its behaviours, its seams and its decisions. Its Intent lists it.
- **Journey**: what a person does with a feature in a real session, from start to end, as a Spec writes it. It crosses several behaviours, and the features beside them.
- **ADR**: a decision that binds more than one change, in `docs/adr/`, written once the Maintainer picks it.
- **Reference**: another repository, fetched at its pin into `.refs/`, to read and never to write. [`CODING-STANDARD.md`](CODING-STANDARD.md) says how to use one.

A change to a feature edits its doc in `docs/features/` in the same commit, and a new feature or row edits the index too. A PR that changes the published package adds a changeset with a short release note: before 1.0, a fix or a feature is a `patch`, and a break of what an author may import is a `minor`. The Maintainer merges the version PR to publish. A concept that is ours, and that could be read two ways, goes in its glossary in the same commit: `docs/glossary.md`, or the list above, capitalized there and wherever it is used in that meaning.

## Commands

| Command | Does |
|---|---|
| `vp install && pnpm refs` | Installs, and fetches each Reference into `.refs/` |
| `vp run ready` | Formats and lints with types, then runs every test and every build. CI runs it on each PR. |
| `vp check --fix` | Formats the tree and fixes what lint can |
| `vp run @easeshine/binnacle#build` | Builds the bundle. A `binnacle` dsh profile that links `packages/binnacle` then runs it with `dsh --profile binnacle`. |
| `vp run @easeshine/binnacle#test` | Runs the package's tests |
| `vp run dev` | Runs the docs website |
