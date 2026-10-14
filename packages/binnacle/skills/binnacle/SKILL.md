---
name: binnacle
description: Writing a plugin that changes binnacle, the terminal app for dsh, from the docs that come with the installed @easeshine/binnacle. Use it whenever you change what binnacle draws, its keys, its theme, its layout, or one of its built-in features, or test such a change.
---

# Changing binnacle

The docs in this package match the version that is installed. Read them before you write a plugin, and read the source only for what they do not say.

## Find the page

1. Read [`docs/author/index.md`](../../docs/author/index.md). Its table *Each way to change something* names the shortest way for each change, and links its page.
2. Read the page of what you change:
   - a built-in feature, such as the composer or the status line: `docs/author/built-ins/<feature>.md`. It names each Place, Look, action, model and Layout that the feature sets.
   - a component, such as a List: `docs/author/components/<component>.md`.
   - Parts, Models, the theme, Looks, actions, Layouts and the Focus: `docs/author/concepts/`.
3. Read [`docs/author/plugin.md`](../../docs/author/plugin.md) to load the plugin in a dsh profile, and to test it.

A word that is capitalized, such as Place or Tone, has the meaning that [`docs/glossary.md`](../../docs/glossary.md) gives it.

## Write it

- Import only what the package exports: `@easeshine/binnacle`, `@easeshine/binnacle/plugins/<feature>` and `@easeshine/binnacle/testing`. binnacle's own built-ins import nothing more, so what they do, a plugin can do.
- Change the least: an edit of one node, a theme layer, a Look, or an action that runs `beneath()`, before you replace a feature whole. What you do not replace stays binnacle's.
- Make text from the agent or a tool plain with `toPlainText` before you draw it.

## Prove it

Test the plugin with `mount` from `@easeshine/binnacle/testing`, as `docs/author/plugin.md` shows. A test reads the screen as rows, so its expected rows are literals that a person would see.
