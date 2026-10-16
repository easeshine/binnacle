# Intent: a person chooses binnacle's colours, and every feature follows them

- **Author:** Patrick Xin
- **Role:** Maintainer
- **Status:** approved
- **Date:** 2026-10-15

## Problem

binnacle draws in the terminal's own colours. A person who wants other colours must ask for code to be written. They have no file to edit, and no list of colour sets to pick from.

Each colour in binnacle is named by what it is for, such as warnings or borders. A change to one colour changes it everywhere. So a person cannot change the colours of one feature alone, such as only the errors on tool cards. An author who wanted that wrote a fixed colour, and the fixed colour then ignores what the person chose.

binnacle has too few colours. A feature that needs a colour with a new meaning, such as a line added to a file, has none to use. binnacle also cannot fill a line with a colour behind its text. In a trial, three authors each built tool cards that needed this. Each one found a different way around it, and none of the three followed the person's colours.

Many people already like a colour set from VS Code or from pi. binnacle cannot use them.

## Proposed outcome

A **palette** is the set of colours that binnacle draws with. It holds only colours. The symbols, the borders and the spacing stay apart from it.

A person:

1. picks a palette from a list, and sees binnacle change as they move through the list, before they choose one.
2. changes any colour by hand, in a file of their own that stays between sessions.
3. asks the author agent to change a colour, for everything or for one feature only, such as "make the errors on tool cards orange". The change goes in the same file, where the person can read it and undo it.
4. keeps their own changes when they pick another palette. A change to one of the palette's colours, such as "the palette's orange", follows the new palette. An exact colour stays as it is.
5. sees binnacle in their terminal's own colours until they pick a palette.
6. picks a colour set that they already use in pi, or a VS Code theme that they installed. binnacle turns a VS Code theme into a palette once, and the person can then change it as they change any other palette.
7. can read every palette, whether the terminal is light or dark. A palette can fill the whole screen with its own background. A palette with a light and a dark version uses the version that matches the terminal.

An author:

8. picks each colour of a new feature from binnacle's full list of colours, named by what they are for. The list covers every colour that pi names, so an author never has to look for a missing one.
9. gives a feature colours of its own, such as "the tool card's error". Each one looks like the general colour until a person changes it.
10. fills a line with a colour across its full width, as for a card, or for a line added to a file.
11. adds a new place that palettes come from, as binnacle adds VS Code themes.

What a person chooses always wins over what a feature sets. A feature only sets how its own colours look until a person changes them.

## Affected users and systems

- **A person** who wants binnacle in colours of their own.
- **An author agent**, and **a person who writes a feature by hand**.
- **Every built-in feature:** each one draws with the full list of colours.
- **pi:** binnacle names its colours as pi does, so a colour set from pi works in binnacle.
- **VS Code:** binnacle reads the themes that a person installed, and changes none of them.

## Constraints

1. The constraints of the [product Intent](../binnacle/intent.md) and of the [authoring Intent](../authoring/intent.md) hold. There is no promise of stability before the first stable release.
2. Colours follow the terminal until a person picks a palette.
3. A person's palette and their own changes are kept in their profile, as every change is.
4. Many installed VS Code themes do not make binnacle slower to start. binnacle reads a theme only when the person looks at it.
5. A VS Code theme does not match binnacle's list of colours exactly. Each colour that has no match still gets a colour that the person can see and change.
6. binnacle renames four of its colours to pi's names. A feature written before the rename must change.

## Stages

Each stage ends in something the Maintainer can try under dsh.

1. **A line filled with a colour.** An author fills a line with a colour of the palette, across its full width.
2. **A palette of a person's own.** The full list of colours, with pi's names. A file of the person's own changes. A list to pick a palette from, which shows each one as the person moves to it. A feature's own colours, and new colours. The author agent is the Chat's own agent, which reads binnacle's skill in every session, and its changes go in the person's file. The colour sets from pi, and the person's own pi themes, are in the list.
3. **VS Code themes.** The installed themes are in the list, and each one becomes a palette when the person picks it. A palette fills the screen with its background, and has a light and a dark version.

## Specs

Each Spec is in a folder of its own beside this Intent, and stays there once it is built, as a record. Its Task is `palette/<folder>`.

| Stage | Spec | Status |
|---|---|---|
| 1 | [A line filled with a colour](fill/spec.md) | built |

## Open questions

None.
