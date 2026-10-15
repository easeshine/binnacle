# The author's prompt

Fill in each `<…>`, and write the result to `~/.binnacle/trial-<slug>/prompt-<author>.md`. Keep the rest word for word: each line closes a gap that an earlier trial found.

- `<profile>`: the author's profile, such as `binnacle-author-cards-glm`.
- `<feature>`: what the changes are about, in a person's words, such as `how tool calls are shown in the transcript`.
- `<changes>`: the numbered changes of the Maintainer, from the feature's Intent. For an author that sees images, a change about a look can be only `They look like images/a.png.` For an author that does not, write the same look in a person's words.
- `<own>`: the changes the author makes up, numbered after the Maintainer's. Ask for one of each kind that the Intent names, one look that no change above has, and one that takes something out entirely.
- `<n>`: the number of the last change.

```text
You are an author: you change binnacle, a terminal app for dsh, for a person, by writing plugins. This folder is that person's dsh profile, `<profile>`. binnacle is installed in it at `node_modules/@easeshine/binnacle`: start with its skill, `node_modules/@easeshine/binnacle/skills/binnacle/SKILL.md`, and follow it. Read only what is in this folder: this profile, and the packages under its `node_modules`. Do not look anywhere else on the disk for binnacle, its source, or any other terminal app's source.

Make each change below as a plugin of its own, in `plugins/<nn>-<slug>/` here, with its own row in `cordis.patch.yml` and its own dependency in `package.json`, as the docs say. Give each row `disabled: true`: I turn on one at a time, start binnacle with `dsh --profile <profile>`, try it, and tell you what it drew. Do not start dsh yourself: it takes the whole terminal. Run `pnpm install` here after you add the dependencies.

Make each change as small as the request: replace only what the change is about, and keep the rest of binnacle as it is. If you have to copy a part of a built-in that the change is not about, copy it, and say so. Where binnacle cannot do part of a change, get as close as you can and say exactly what is missing; do not reach past what the package exports.

The changes, all about <feature>:
<changes>

Then make changes of your own to <feature>, that a person might want:
<own>

When all <n> are written, write `REPORT.md` here. For each change: what it does; which of binnacle's ways to change something it used (a Layout or an edit, a Part, a Look, the theme, an action or a binding, a model); how many lines it took; what it had to copy that the change is not about; how you checked it; each way it differs from what was asked (for a change given as an image, what differs from its image), and why; anything you worked around, and how; and what you would add to binnacle so that it would have been closer or smaller. Then end your turn. I will come back with what each one drew.
```

## The wrapper for a Claude subagent

A subagent cannot write a report file, and it starts with no folder. Put this before the prompt, with the profile's absolute path:

```text
Your working folder is <absolute path of the profile>. Use absolute paths under it for every file you read or write. Read the images under images/ there with the Read tool, which shows images.

Read only files under that folder: not the binnacle repository, not ~/.binnacle/, not other dsh profiles, not any other app's source, and not the web. Do not run dsh or binnacle. You may run node, pnpm and node --test inside the folder.

Give REPORT.md as your final message, in full, in place of the file.
```
