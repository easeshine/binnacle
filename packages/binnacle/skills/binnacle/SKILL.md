---
name: binnacle
description: Changing binnacle, the terminal app for dsh, from the docs that come with the installed @easeshine/binnacle. Use it whenever a person asks to change binnacle's colours, keys, layout or one of its features, such as "make the errors on tool cards orange", or you write or test a plugin that changes what binnacle draws.
---

# Changing binnacle

The docs in this package match the version that is installed. Read them before you write a plugin, and read the source only for what they do not say.

## A person's colours

A colour that a person asks for goes in their own file, `palette.json`, at `$DSH_PROFILE_DIR/palette.json`. Never write a plugin for it: the file wins over every plugin, and binnacle draws in it as soon as it is saved.

1. Read [`docs/use/colours.md`](../../docs/use/colours.md). It says what the file holds: `palette`, `hues` and `colors`.
2. Find the Tone of what the person names. The theme's own Tones are in [`docs/author/concepts/theme.md`](../../docs/author/concepts/theme.md#the-tones), and each feature's own in its page under `docs/author/built-ins/`, such as `transcript.card.error` for the errors on tool cards.
3. Read the file, if it is there, and set the Tone under `colors`, such as `"transcript.card.error": "orange"`. Keep each other key as it is, and write JSON with two spaces of indent.
4. When binnacle cannot read the file, its status line says what is wrong, and where. Mend that first.

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
