# Spec: the full list of colours, Hues, and a feature's own colours

- **Intent:** [Colours](../intent.md), Stage 2, *A palette of a person's own*: "The full list of colours, with pi's names. … A feature's own colours, and new colours." It serves outcomes 4, 8 and 9: a change to "the palette's orange" follows the palette; an author "picks each colour of a new feature from binnacle's full list of colours, named by what they are for"; and a feature's own colours each look "like the general colour until a person changes it". The person's file, the list of palettes, pi's sets and the Chat's agent are the next Spec of Stage 2, `own-palette`.
- **Status:** agreed

## Problem

An author who draws a quote, a line added to a file or a thinking level finds no Tone for it. binnacle has 14 Tones (`api.ts#Tone`), and pi names 56, so a palette made for pi has no place to put most of its colours here. Four of binnacle's Tones, `heading`, `code`, `link` and `selection`, mean what pi calls `mdHeading`, `mdCode`, `mdLink` and `selectedBg`.

A Tone names a colour, such as `cyan`, and a colour is either the terminal's own or exact. There is no colour of the theme's own between them, so a change to "the palette's cyan" cannot reach each Tone drawn in cyan, and there is no orange at all.

An author cannot give a feature colours of its own. The tool cards draw an exit status in `error`, so a person who wants that orange makes every error orange. An author who paints a fixed colour instead ignores the theme.

## Behaviour

1. An author paints in one of pi's Tones that binnacle did not have, such as `mdQuote`, and it draws in its default.
2. An author paints in `mdHeading`, `mdCode`, `mdLink` or `selectedBg`, and it draws as `heading`, `code`, `link` and `selection` drew.
3. A theme layer that names `heading`, `code`, `link` or `selection` is refused, and the error names the new name. `paint` and `fill` of one of the four old names throw the same error.
4. A Tone in a Hue, such as `{ color: 'cyan' }`, draws in the Hue's colour, and a layer that gives the Hue an exact colour changes each Tone in it.
5. A Tone in an exact colour stays as it is when a layer changes a Hue.
6. A Tone in `orange` draws as the colour 208 of 256, and a layer can give `orange` another colour.
7. A background in a Hue follows the Hue, as a colour does.
8. A layer that names a Hue that is not one, or gives a Hue a colour that is not one, is refused, and the error names the Hue.
9. A Tone `{ like: 'error' }` draws as `error`, and follows `error` when a layer changes it.
10. A Tone `{ like: 'error', bold: true }` draws as `error` with bold over it.
11. A layer that gives a Tone of `like` its own colour wins over the Tone it was like.
12. A layer whose `like` makes a loop, such as `a` like `b` and `b` like `a`, is refused, and the error names the Tones of the loop.
12a. A loop that a layer's going leaves, as when the layer that broke it unloads, draws each Tone of the loop with its own Style alone, and the unload does not fail.
13. A Tone like a Tone that no layer gives draws with its own attributes alone.
14. `paint({ like: 'error' }, text)` draws as the Tone does, and follows the theme.
15. An author gives a Tone of a new meaning, such as `diffMoved`, a colour in a layer, and paints in it.
16. Text painted in a Tone that no layer gives draws plain.
17. `binnacle.tokens` gives each Tone's Style as it draws, its `like` read, and the colour of each Hue.
18. A markdown heading, inline code, code block, quote, rule, link and list bullet each draw in the Tone of `md…` that pi names for them, and look as they did.
19. A tool card's line added and line removed draw in `toolDiffAdded` and `toolDiffRemoved`, its title in `toolTitle` and a terminal's output in `toolOutput`, and each looks as it did.
20. A prompt in the transcript draws in `userMessageText`, and reasoning in `thinkingText`, and each looks as it did.
21. Each built-in feature draws each general Tone through a Tone of its own, named as its Looks are, such as `transcript.card.error`, which looks like the general Tone until a layer changes it.
22. A layer that gives `transcript.card.error` the colour `orange` draws a tool card's exit status in orange, and each other error stays in `error`.

## Journeys

The Journeys use one plugin in the profile, the colours plugin. It adds a theme layer, and its commands add or take out a second.

1. **The tool card's error alone.** In the Chat, ask the agent to run `exit 3`, then to read a file that does not exist. The tool card shows `exit 3` in `red`, and the transcript's `✗` line of the failed read is red too. Run `/pink`, which gives `error` the colour `#ff5f87`: both take it at once, as the card's own Tone is like `error`. Run `/orange`, which adds a layer of `{ colors: { 'transcript.card.error': 'orange' } }`: the card's `exit 3` is orange, the colour 208, and the `✗` line stays pink. Run `/orange` again, then `/pink` again: each layer goes, and both are red again.
2. **The palette's orange.** Run `/orange` again, then `/amber`, which gives the Hue `orange` the colour `#ffaf00`. The card's `exit 3` takes `#ffaf00` at once. The colours plugin's status segment, `amber`, is filled with the background `orange`, and its background takes it too. Run `/amber` again: both are the colour 208 again.
3. **A Hue across every Tone in it.** Ask the agent for an answer with a heading, a list and a link. The heading and a marked command in the offer of `/` draw in `cyan`, and the frame of a Request in `#00afaf`. Run `/cyan`, which gives the Hue `cyan` the colour `#5fd7ff`. Each of them takes it at once, and the heading stays bold. The colours plugin's own layer gives `borderAccent` the exact colour `#00afaf`, so the frame of a Request does not change. Run `/cyan` again, and each one is the terminal's cyan again.
4. **Each built-in in pi's Tones and its own.** Run `/pieces`, which adds a layer that gives `mdQuote` `magenta`, `toolDiffAdded` `#00ff87`, `toolTitle` `{ bold: true }`, `toolOutput` `bright-black`, `userMessageText` `yellow`, `thinkingText` `{ italic: true }`, `composer.muted` `cyan` and `status.success` `magenta`. On a model that reasons, ask for an answer with a quote, then for a line added to a file, then for `ls`. Your prompt is yellow, the reasoning italic, the quote magenta, the card's `+1` `#00ff87`, each card's title bold, and the output of `ls` bright black. Type a draft taller than the composer: its `↑ 3 more` row is cyan. Drag across a word and let go: the status line's `copied` is magenta. Run `/pieces` again, and each looks as it did.
5. **Nothing changes with no layer.** Take the colours plugin out of the profile, and restart binnacle. Ask for an answer with a heading, inline code, a code block, a quote, a rule and a link, then for an edit of a file. Each draws as it did before this Spec: the quote and its bar in `bright-black`, the rule dim, the `+` count green and the `-` count red, and a drag selects in inverse.
6. **A feature written before the rename.** Put the colours plugin back, with a layer that gives `heading` the colour `magenta`, and restart binnacle. The plugin does not load, and its error says that `heading` is now `mdHeading`. Change it to `mdHeading`, and restart: the heading is magenta.
7. **The notice in its own Tones.** In the profile's `cordis.patch.yml`, give the row `binnacle-notice` the config `latest: 'data:application/json,{"version":"99.0.0"}'` and `told: /tmp/binnacle-told.json`, then start binnacle. Above the first event, the notice draws its rules and `Update Available` in `warning`, its words in `muted`, and the command and the changelog in `accent`. Run `/notice`, which adds a layer that gives `notice.warning` `magenta`, `notice.muted` `cyan` and `notice.accent` `orange`: at once, the rules and `Update Available` are magenta, the words cyan, and the command and the changelog orange. Ask for a command that fails: its warning or error in the transcript keeps `warning` or `error`. Run `/notice` again, and the notice is in `warning`, `muted` and `accent` again. Delete `/tmp/binnacle-told.json` before each start, so the notice shows again.

## Seams

- **The terminal**, through `@easeshine/binnacle/testing`'s mount: a plugin's theme layer and a Part in, or a built-in fed dsh's events. Out come the drawn rows and each cell's style.
- **`binnacle.tokens`**, for Behaviour 17.
- **The error of `binnacle.theme` and of `paint`**, for Behaviours 3, 8 and 12.

## Decisions

1. **The list is pi's, whole.** Each colour in pi's theme schema is a Tone, by its name, the 51 that pi needs and the 5 that pi lets go. `export.*` is for pi's HTML export, and binnacle has none. binnacle's own ten that pi also names keep their names. The four that pi names otherwise are renamed, as Constraint 6 says, and no old name stays beside the new. A Tone that nothing in binnacle draws yet, such as `syntaxKeyword`, is in the list all the same, so a feature that draws it later finds it.
2. **A Tone's name is open.** `Tone` is pi's names, then any other string, so an author's own Tone and a feature's own type-check, and an editor still offers pi's names. A Tone that no layer gives draws plain, as before. A typo is not caught; the names are many and grow with each feature, so a check would refuse what an author means.
3. **The old four are refused until 1.0.** A layer, `paint`, `fill` and a `like` that names one throw `binnacle: the Tone 'heading' is now 'mdHeading'`, so a feature written before the rename fails where its author reads it, and does not draw plain.
4. **A Hue is one of a fixed list: the terminal's sixteen, and `orange`.** Each palette gives every Hue, so a person's change to "the palette's orange" always finds it in the next palette. The sixteen are Hues by their names already, so each Tone of the defaults is in a Hue with no change. A layer gives Hues as `{ hues: { cyan: '#5fd7ff' } }`. A Hue's colour is a 256-colour index or an exact colour. One of the sixteen by name, as the value of its own Hue, is the terminal's own, which is each sixteen's default. A Hue cannot be another Hue, so there is no loop.
5. **`orange` is 208 by default.** The sixteen have no orange. 208 is the orange of the 256 that every terminal of 256 colours draws alike.
6. **`like` names a Tone, and is read at each draw.** A Style may name `like`, and its own colour, background and attributes lie over the Tone's. It is read when the Tokens are made, after each layer, so a Tone like `error` follows each later change to `error`, and a layer that gives the Tone its own Style replaces the `like` with it, as a layer replaces any token. A loop is refused by `binnacle.theme`, against the Tones as they would be with the layer, so an author learns of it at load. A layer that goes is never refused, so a loop can still come back when the layer that broke it goes: then each Tone of the loop draws its own Style alone, its `like` left out, as for a `like` of a Tone that no layer gives. So a feature's Tone like another plugin's that unloaded still draws, and no draw and no unload throws.
7. **A feature's own Tone is named as its Looks are**, `<the feature's Look name>.<the general Tone>`, such as `transcript.card.error`, and the feature gives it in a theme layer of its own, `{ like: '<the general Tone>' }`. A built-in's layer ranks beneath an author's, as every registration does, so a person's change wins over it. A feature names its own Tone only where it draws a general Tone; where pi names the piece, such as `toolDiffAdded`, it draws in pi's Tone.
8. **The defaults give no background.** Each Tone of pi's that is a background, `…Bg`, is empty, as pi draws when the terminal reports no colours, so nothing new is drawn behind the text. `selectedBg` keeps `selection`'s `inverse`, so the Selection still shows. A background that reads on the person's terminal comes with a palette.
9. **A built-in moves to pi's Tone for what it draws, and looks as it did.** The default of each such Tone is `like` the Tone the built-in drew in before, so the move draws nothing new, and a picked palette reaches each piece. The table below gives the defaults.
10. **The kit's components keep the general Tones.** A List, Tabs, a Line, a Title and a `frame` are drawn with them, as they are in every feature that uses them. A person colours one instance through its Looks. A Tone for each component's pieces is not in Stage 2.

The defaults:

| Tones | Default |
|---|---|
| `text` | `{}` |
| `accent`, `borderAccent` | `cyan` |
| `muted` | `bright-black` |
| `dim`, `border`, `borderMuted` | `{ dim: true }` |
| `success`, `warning`, `error` | `green`, `yellow`, `red` |
| `mdHeading` | `{ color: 'cyan', bold: true }` |
| `mdCode` | `yellow` |
| `mdLink` | `{ color: 'blue', underline: true }` |
| `selectedBg` | `{ inverse: true }` |
| `searchMatchBg` | `{ like: 'selectedBg' }` |
| `searchMatchText`, `scrollbarThumb`, `toolTitle`, `toolOutput`, `mdLinkUrl`, `mdListBullet` | `{ like: 'text' }` |
| `scrollbarTrack`, `customMessageText`, `mdQuote`, `mdCodeBlockBorder`, `toolDiffContext`, `syntaxComment`, `syntaxOperator`, `syntaxPunctuation` | `{ like: 'muted' }` |
| `mdQuoteBorder` | `{ like: 'mdQuote' }` |
| `mdCodeBlock` | `{ like: 'mdCode' }` |
| `mdHr` | `{ like: 'border' }` |
| `thinkingText` | `{ like: 'dim' }` |
| `userMessageText` | `{ like: 'accent' }` |
| `toolDiffAdded`, `toolDiffRemoved` | `{ like: 'success' }`, `{ like: 'error' }` |
| `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg` | `{}` |
| `customMessageLabel`, `syntaxType` | `magenta` |
| `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber` | `blue`, `yellow`, `cyan`, `orange`, `green` |
| `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh`, `thinkingMax` | `bright-black`, `blue`, `bright-blue`, `magenta`, `bright-magenta`, `red`, `orange` |
| `bashMode` | `green` |

Each built-in, what it draws in a Tone of pi's, and its own Tones. A built-in names its own Tone for each general Tone that it paints, by its name or through a table of its own, such as the status line's `NOTICES` or the transcript's `SEVERITY`:

| Built-in | In pi's Tones | Its own Tones |
|---|---|---|
| the kit's markdown | heading `mdHeading`, inline code `mdCode`, a code block `mdCodeBlock`, a quote's text `mdQuote` and its bar `mdQuoteBorder`, a rule `mdHr`, a link `mdLink` and its address `mdLinkUrl`, a list's bullet or number `mdListBullet` | none: the kit keeps general Tones (Decision 10) |
| the tool cards | a line added `toolDiffAdded`, a line removed `toolDiffRemoved`, the title `toolTitle`, a terminal's output `toolOutput` | `transcript.card.accent`, `transcript.card.success`, `transcript.card.error`, `transcript.card.warning`, `transcript.card.muted`: the mark of a call that runs, succeeded or failed, an exit status, `(truncated)`, and the earlier lines, the time, the count and a done todo |
| the transcript's view | a prompt `userMessageText`, reasoning `thinkingText` | `transcript.error`, `transcript.warning`, `transcript.muted`, `transcript.dim`: a failed call's line, each notice by its severity, `more lines`, and the context line |
| the composer | none | `composer.muted`: a row such as `↑ 3 more`, of a tall draft's hidden rows |
| the status line | none | `status.text`, `status.success`, `status.muted`, `status.error`: a segment, and a copy that was copied, sent to the terminal, or failed |
| the notice | none | `notice.warning`, `notice.muted`, `notice.accent`: the rule, the words, and the command and the changelog |
| the core | the Selection `selectedBg` | none: a box's border stays `border` |

## Edges

| Edge | Answer |
|---|---|
| A layer with no `hues` | The Hues stay as they were, as for each token a layer does not name |
| A Hue not in the list, such as `purple` | Behaviour 8 |
| A Hue's colour that is not one, or is another Hue | Behaviour 8, Decision 4 |
| One of the sixteen given to its own Hue | The terminal's own, its default (Decision 4) |
| A Hue on a terminal of 256 colours | An exact colour draws as the nearest of 256, as before |
| A background in a Hue | Behaviour 7 |
| `like` of itself, or a longer loop | Behaviour 12 |
| A loop that comes back when a layer goes, by a dispose or a plugin's unload | Behaviour 12a, Decision 6 |
| `like` across layers: the Tone it is like changes, or its layer goes | Behaviour 9, and Behaviour 13 when no layer gives it |
| `like` with a Style over it | Behaviour 10 |
| A layer that names a feature's Tone before the feature loads, or while it is off | An author's layer ranks above the built-in's whenever each loads (Decision 7). With the feature off, nothing draws the Tone. |
| The plugin that gave a feature's Tone unloads | Its layer goes, and everything is drawn again, as for any layer |
| An old name in a layer, in `paint`, in `fill`, in `like` | Behaviour 3, Decision 3 |
| A Tone that no layer gives | Behaviour 16 |
| `tokens` read while a `like` points to a Tone no layer gives | The Tone's own Style, as it draws (Behaviour 13, 17) |
| A fill in a Tone of `like`, or in a Hue | It fills as `fill` does, with the Style as it draws |
| The Selection over text drawn in a Hue | `selectedBg` draws over it as `selection` did (Behaviour 2) |
| After it: the Focus and the keys | No Tone and no Hue changes a key, a click or the Focus |

## Out of scope

- The person's own file, the list to pick a palette from, pi's colour sets, and the Chat's agent: `own-palette`, the next Spec of Stage 2.
- A background in the defaults, and a new look that uses one, such as tool cards drawn on `toolSuccessBg`: a palette gives the background, and each look is a change of its own.
- pi's `export.*` colours: binnacle has no HTML export.
- A Tone for each piece of the kit's components (Decision 10).
- Syntax highlighting, scrollbars, a search's match, and thinking levels: their Tones are in the list, and nothing draws them yet.
- A palette's light and dark versions, and a background behind the whole screen: Stage 3.

## Parts of the build

1. **An author paints in each of pi's Tones, in a Hue, or like another Tone.**
   - Behaviours 1 to 17, and 12a. Before the build, at `origin/main`: a Tone of pi's that binnacle lacks, a `like` and a Hue's change each draw plain or as the colour named, so each test of Behaviours 1, 2, 4 to 7 and 9 to 14 fails at its first assertion on a cell's colour; a layer with `hues`, an old name, or a loop loads, so each test of 3, 8 and 12 fails on the refusal, and 12a fails as its loop's Tone draws plain where its own Style has a colour; and `tokens` has no `hues`, so 17 fails. Behaviours 15 and 16 hold already at run time: their tests guard them, and the change is `Tone`'s type (Decision 2).
   - Code: `src/api.ts` (`Tone`, `Hue`, `Style#like`, `Tokens#hues`, `ThemeLayer#hues`), `core/theme.ts` (the defaults, the Hues, `like`, the refusals), and each place that names an old Tone: `core/drawing.ts` and `kit/markdown.ts`, which draw as before.
   - Records: the `AGENTS.md` of `src/core/` and `src/kit/`, `author/concepts/theme.md` (the list, the Hues, `like`, a feature's own Tone), the glossary's **Tone** and **Hue**, `author/built-ins/copy.md`, `author/concepts/parts-places-screens.md`, and a changeset, a `minor`: the four names are a break of what an author may import.
2. **Each built-in draws in pi's Tone for what it draws, and in its own Tones.** Behaviours 18 to 22. Before the build, each built-in paints a general Tone, so a layer that changes `mdQuote`, `toolDiffAdded` or `transcript.card.error` changes nothing it draws, and each test fails at its assertion on that cell's colour. After Part 1.
   - Code: `kit/markdown.ts`, and each built-in in the table above, with the layer of its own Tones. A test of each built-in gives each of its own Tones a colour in a layer, and finds it on the piece that the table names.
   - Records: the `AGENTS.md` of `src/kit/` and of each built-in, its page in `author/built-ins/` with its own Tones, and a changeset, a `patch`.

## Door

Two-way: every PR is two-way before 1.0, as `.agents/doors.md` says.
