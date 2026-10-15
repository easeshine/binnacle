# Writing a Spec

A Spec is the design of one feature, in `intents/<slug>/spec.md`, beside its Intent. The Reviewer checks it in Round 0. Then each Part's builder and Reviewer read it as their contract. [`intents/select-and-copy/spec.md`](../../../intents/select-and-copy/spec.md) is a Spec that was built.

## Steps

1. Read the feature's Intent, and the product's Intent.
2. Read the code, the `AGENTS.md` files and the docs that the Spec touches.
3. Answer each question about dsh, pi-tui or another Reference with the `research` skill.
4. Write each section below.
5. Walk each behaviour's edges, as *Edges* says. Each edge gets a behaviour or a decision.
6. Answer each open choice under **Decisions**, with its reason.
7. Cut the build into Parts, as *Parts* says.
8. Link the Spec from its Intent.

## The sections

| Section | Holds |
|---|---|
| The title and its list | `# Spec: <feature>`, then **Intent**: a link to the Intent and the outcome it serves, and **Status**: `draft`, `agreed` or `built` |
| **Problem** | What a person or an author cannot do today, as they would say it |
| **Behaviour** | What a person or an author can do after the change, numbered. One sentence each, as a person would say it. Each sentence becomes the name of one test. |
| **Journeys** | What a person does with the feature in a real session under dsh, from start to end: each step that they type, click or read. Name the features that share the screen on the way. The Maintainer tries each Journey once the Spec is built. A Spec that changes nothing a person sees has none. |
| **Seams** | Where the tests observe the change, from outside. Use the fewest seams that hold every behaviour. |
| **Decisions** | Each choice that the build needs, with its answer and its reason |
| **Edges** | Each edge from *Edges*, and the behaviour or the decision that answers it |
| **Out of scope** | What the Spec does not do, and what does it instead |
| **Parts of the build** | The Parts, numbered, as *Parts* says |
| **Door** | One-way or two-way, as *Doors* says, and why |

- The design goes in the Spec, not in the Intent. A decision that binds more than one change is a candidate ADR: offer it to the Maintainer after the try.
- Order the behaviours so that each builds on the one before. The first is the thinnest one that crosses every seam.
- Cite code by its path and symbol, such as `src/core/AGENTS.md` or `kit/index.ts#wrap`. A line number goes stale. A Spec cites no Reference path.

## Edges

Round 0's findings are most often an edge that no behaviour names. For each behaviour, say what happens:

- **At the ends:** the first and the last item, and a move past them.
- **With nothing:** no item, no option, an empty answer.
- **With too much:** more than the screen holds, a long line, a narrow terminal.
- **When it goes part-way:** the thing is withdrawn, replaced or unloaded while it is shown, or while it waits.
- **When it is another's:** another agent's, another Place's, or a stored session's.
- **After it:** where the Focus and the keys are when it ends, and what the person does next. A person who must click or press a key only to get back to where they were is a finding.
- **Beside another feature:** another feature that shares the screen, the keys or the clicks.

Then hold each behaviour to what the Intent promises a person. A person reads what happens without dsh's data, such as raw JSON, and binnacle does at least what a plain terminal does, such as selecting and copying text.

## Parts

A **Part** is one vertical slice of the Spec: one numbered item under **Parts of the build**, built on one branch and merged in one PR. Each item starts at the margin with its number and a bold title that says what a person or an author can do. Its lines under it are indented, so that the Task tool reads the item to its end:

```markdown
1. **A drag selects, a release copies.**
   - Behaviours 1 to 13.
   - Records: the `AGENTS.md` of `src/core/`, and `use/copy.md`.

   One-way: it adds a Tone.
2. **A copy reaches the system's clipboard.** Behaviour 14. Two-way. After Part 1.
```

- **A vertical slice.** A Part cuts a thin path through each layer that the change needs: the core, the plugin, the records and the tests. A Part that changes one layer only is a horizontal slice. Join it with the slice that uses it.
- **It can be tried.** The Maintainer can try each Part when it merges, or a test shows its behaviour.
- **Fewer Parts.** Each Part costs a build and its Rounds. Cut a Spec only for a reason: two Parts can be built at the same time, a part can merge and be tried before the rest, or one Part would be too large to review well. A Spec with none of these is one Part.
- **Prefactors first.** A prefactor is a change that makes the rest easy. It is a Part of its own, before the Parts that need it.
- **The order is said.** A Part that needs another says `After Part <k>.` Two Parts that change one shared file, such as a table, a registry or a type, are in an order. A row added to a doc's table, and a changeset, are no order.
- **Each behaviour fails before the build.** For each behaviour, name what would show it false, and check that it is false at `origin/main`.
- **Its Door.** A Part says `One-way` or `Two-way`, with why, when it differs from the Spec's Door.

A wide refactor, such as a rename that breaks each place that uses a name, has no vertical slice that passes `vp run ready`. Cut it as expand, migrate and contract: add the new form beside the old; move the users to it, in batches, one Part each; then remove the old form.

## Doors

A PR is **one-way** if it does one of these things:

- changes what an author may import;
- changes the dsh services or packages that binnacle names;
- moves a pin;
- changes a format that a person keeps, such as a theme or the profile;
- changes a release workflow;
- changes this list.

Every other PR is **two-way**. If the Spec and the Part give different Doors, the Door is one-way.
