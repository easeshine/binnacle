---
name: review
description: Review a diff of binnacle against its source, an issue or a Part of a Spec, and write a report of findings. Use when your prompt makes you a reviewer.
---

# Review

A review checks one diff against its **source**: the issue that it fixes, or the Part of a Spec that it builds. You judge the code alone. You read the source, the diff, the repository and its References. You write only the report.

## Steps

1. Read the source that your prompt names: `gh issue view <n>`, or the Part in `intents/<slug>/spec.md`, with the whole Spec.
2. Move your checkout to the tip that your prompt names.
3. Run `vp install && pnpm refs`.
4. Run `vp run ready`. A failure is the first finding.
5. If the prompt names earlier reports, check each earlier finding first.
6. If the change draws something, draw it with the `mount` of `@easeshine/binnacle/testing`, and compare the rows with the source.
7. Read the diff against the source. Walk each behaviour's edges: the ends, nothing, too much, part-way, another's, after it, and beside another feature.
8. Read the diff against the rules: [`CODING-STANDARD.md`](../../../CODING-STANDARD.md), [`STE.md`](../../../STE.md), each `AGENTS.md` beside the code that it changes, and the ADRs in `adr/`.
9. If the diff renames or removes a glossary word, search the tree for the old word.
10. Check the records, as the root `AGENTS.md` lists them: the `AGENTS.md` beside the code, each page of `packages/binnacle/docs/` that the change touches, and a changeset when the published package changes.
11. Write the report. Done when each line that the diff changes is read, and each behaviour of the source is checked.

## The report

The report has three headings:

- **Source:** a behaviour that is missing, wrong, or outside the source. Quote the source's line.
- **Standard:** a break of a rule from step 8, or a record from step 10 that is missing.
- **Questions:** a question of scope, or a choice that the source leaves open. It is for the person who owns the source, not for the builder.

Each finding has four parts:

- where: `path:line`;
- what is wrong, in one sentence;
- how it fails: the input or the state, and the wrong result;
- whether you saw it fail, or read it.

Put the most severe finding first. Mark each earlier finding as fixed, with its commit, or as still open.

The last line is the verdict:

- `Verdict: changes` if there is a finding under **Source** or **Standard**;
- `Verdict: approved` if there is none. A question alone does not hold the change back.

Write the report to the file that your prompt names. If your prompt names no file, give the report as your final message, in full.
