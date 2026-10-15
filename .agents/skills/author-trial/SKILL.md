---
name: author-trial
description: A blind trial of authoring, where agents of other model families change binnacle from the packed package alone, to find what an author cannot change.
disable-model-invocation: true
---

# An author's trial

A **trial** gives a feature's changes to authors who know only what any author gets: the packed package, its docs and its skill. Each author writes each change as a plugin, and a report. The trial finds the gaps: what an author cannot change in a small change.

Models differ, so an author's code and report are evidence, not truth. Run authors of more than one family, and check each claim against the package yourself.

## Run a trial

1. **Pick the changes.** Take the Maintainer's changes from the feature's Intent. Add the author's own: one of each kind, one look that no change has, and one that takes something out. Done when each change is one plain sentence, or one image.
2. **Pick the authors.** Take at least two families. The defaults:

   | Author | Runs in | Sees images |
   |---|---|---|
   | `zai/glm-5.3`, thinking `max` | pi, in a herdr tab | no |
   | `openai-codex/gpt-6.1-sol`, thinking `high` | pi, in a herdr tab | yes |
   | Claude `sonnet`, effort `high` | a subagent, on the Maintainer's word | yes |

   `pi --list-models` says which models see images. Give a change that is an image only to an author that sees images, and the same change in words to the others.

3. **Pack binnacle.** Run `vp run @easeshine/binnacle#build`, then, in `packages/binnacle`, `pnpm pack --pack-destination ~/.binnacle/trial-<slug>`. Done when the tarball is there: the author installs the package as a person does, and never the repository.
4. **Make a profile for each author**, `~/.dsh/profiles/binnacle-author-<slug>-<author>`. Make each one from nothing, never from another author's profile, which may hold its plugins:
   1. Copy [`profile/cordis.patch.yml`](profile/cordis.patch.yml) into it.
   2. Write `cordis.yml` as `[]`, and `pnpm-workspace.yaml` with `packages: ['.']`, `nodeLinker: hoisted` and `autoInstallPeers: false`.
   3. Write `package.json`: `private`, `dsh.profile.bundles` of `@deepseek-ai/dsh-base` and `@easeshine/binnacle`, and the one dependency `@easeshine/binnacle` as `file:` the tarball.
   4. Run `pnpm install` in it.
   5. If a change is an image, copy it to `images/`, with a name that names no product, such as `a.png`. Add `now.png`, a screenshot of what binnacle draws today.
5. **Write each prompt** from [`prompt.md`](prompt.md).
6. **Start each pi author:**
   1. Run `herdr tab create --cwd <profile> --label author-<slug>-<author> --no-focus`, and keep the pane and tab ids under `~/.binnacle/trial-<slug>/`.
   2. Run `herdr agent start author-<slug>-<author> --kind pi --pane <pane> -- --model <model> --thinking <level> --session-dir ~/.binnacle/trial-<slug>/session-<author>`. Pass each flag as a word of its own: a quoted string reaches pi as one unknown option.
   3. Run `herdr agent prompt author-<slug>-<author> "$(cat <prompt>)" --wait --until working`.
7. **Start a Claude author** with the Agent tool, in the background, with its model and effort, and the subagent wrapper of `prompt.md` before its prompt. Save its final message as its profile's `REPORT.md`.
8. **Wait.** Run `herdr agent wait author-<slug>-<author> --until idle --until done` in the background, for each pi author. Done when each profile has its plugins and its `REPORT.md`.

## Check the results

Do every check yourself. An author's report is a claim.

1. **Run each author's tests** with `node --test`. Read how the author named its test files first.
2. **Look for shortcuts** in each plugin:
   - raw escape codes, such as `\x1b[`;
   - `internals`, or a service that the author docs do not name, such as `ctx.get('tools')`;
   - an import that is not `@easeshine/binnacle`, `@easeshine/binnacle/plugins/<feature>` or `@easeshine/binnacle/testing`;
   - a built-in's code, copied.

   A shortcut is a gap, whichever author took it: the supported way was missing, or the author could not find it.
3. **Check each wall that a report names** in the package's exports, its docs and the core's source.
4. **Sort each wall:**

   | Sort | When |
   |---|---|
   | binnacle's gap | every author hit it, and the package has no way through |
   | a gap in the docs | the package has a way, and an author missed it or guessed |
   | the model's ceiling | another author passed it with what the package documents |

   Done when each wall has its sort and its evidence: a file and a line, or an export.
5. **Try the plugins under dsh** when the Maintainer asks, one at a time, as [`driving.md`](driving.md) says. If the feature draws dsh's events, try it in PTC mode too.

## Report to the Maintainer

1. Start with the answer: can an author make the changes, and which walls are binnacle's.
2. Give a table of the authors: the changes made, the tests that pass, the shortcuts taken, the time and the cost.
3. List each wall with its sort and its evidence.
4. Say where each profile, prompt and session is kept.
