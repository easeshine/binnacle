---
name: pr
description: Write a pull request's body, which shows the change, its evidence, what a merge risks, and what was checked. Use when you open a PR, or write a Part's `pr.md`.
---

# A PR's body

A PR reads alone: a person knows what it does, why, and what it risks, with no other record. Show the change; do not tell its story. The commits hold the story. Use the words of the glossaries. Write no preamble.

## The shape

The body is [`.github/pull_request_template.md`](../../../.github/pull_request_template.md), filled in:

```markdown
## Summary

<one or two sentences: what a person or an author can do now, and why>

<a picture of the change>

## Evidence

- **Before:** <what was drawn, or how a test failed>
  **After:** <what is drawn, or the test that passes>

## Merge danger

**Door:** <one-way or two-way, and why>

**Blast radius:** <one word>

<what could break, and for whom, when the word does not say it>

## Checked

<each item of the template's list, answered>

Closes #<n>
```

A Part's `pr.md` holds only **Summary**, **Evidence**, and **Merge danger** without the Door. `task land` adds where the Part fits, the Door, **Checked**, and the review.

## Summary

Pick the smallest picture that makes the point. Most PRs need one; few need three.

| The change is in | Show it as |
|---|---|
| logic | pseudocode |
| what calls what at run time | a call tree |
| what draws what | a tree of Parts, Looks or Places, with the state that matters |
| which file holds what | a shallow file tree |
| messages between dsh, binnacle and the terminal | a Mermaid `sequenceDiagram` |
| a shape that exists already | a `diff` of that shape |

A `diff` of a shape shows only what moves:

```diff
 submit
   draft.take
+  draft.expand
   dsh.send
```

Show a whole block of code only when most of it is new, or when the order of its lines is the point. Put each picture next to the sentence that it supports. Keep only the calls, files and states that the sentence needs.

## Evidence

Evidence shows the change before and after, strongest first:

1. **What a person sees:** the rows drawn before and after, from the `mount` of `@easeshine/binnacle/testing`, or a capture of the branch under dsh, in a fenced block.
2. **A test that failed, then passes:** its name, and its failure in the failure's own words.
3. **A script or a check:** its output on the broken case and on the fixed one.

## Merge danger

- **Door:** one-way or two-way, as [`.agents/doors.md`](../../doors.md) says, and why.
- **Blast radius:** who a mistake reaches, in one word or a short name: the transcript, one feature, every author, every person, the agents' workflow, the release.

## Checked

Answer each item of the template's list; never leave a box empty without a reason. Also list:

- each review Round, its findings, and the commit that answered each, since the reports live where GitHub does not see them;
- what you drove under dsh, and what it drew;
- the change to what an author may import, or "Author API: none".
