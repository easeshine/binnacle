---
name: doc
description: Show a long markdown file to the person in the browser, where they edit it and comment on it, and read their edits and comments back, pass by pass.
argument-hint: "Which file?"
disable-model-invocation: true
---

# Doc

A long file, such as an Intent, a Spec or a handoff, is hard to answer in the terminal. The doc page shows it in the browser. The person edits a block, comments on a block or on selected text, and presses **Hand over**. You read what they changed, answer each comment, and start the next pass. Done when the person hands over with no thread waiting for you, and says the file is settled.

## A pass

1. Run `node .agents/skills/doc/scripts/doc.mjs <file.md>` in the background. It opens the page, and prints `DOC <file>` and the link. Give the person the link.
2. Wait for it to exit. It prints `HANDOVER`, whether the file was edited, and how many threads wait for you.
3. If the file was edited, read the edits with the `git diff --no-index` command that it prints. Keep each edit: the person's words win.
4. Read `comments.json` in the doc folder. A thread waits for you when the person spoke last in it.
5. Answer each thread that waits: add `{ "by": "agent", "text": "…", "at": "<ISO time>" }` to its `replies`, and change the file as the answer says.
6. Start the next pass. The person resolves each thread that is settled.

## The doc folder

`~/.binnacle/docs/<hash>-<name>/` holds the file's passes:

- `before.md`: the file as this pass began, for the diff.
- `comments.json`: each thread. A thread has `id`, `quote` (the selected text), `context` (the first 80 characters of its block), `block`, `text`, `by`, `at`, `resolved` and `replies`. To start a thread yourself, add one with `"by": "agent"`.

When the file is settled, delete its doc folder.
