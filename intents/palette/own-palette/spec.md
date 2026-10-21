# Spec: a palette of a person's own

- **Intent:** [Colours](../intent.md), Stage 2, *A palette of a person's own*: "A file of the person's own changes. A list to pick a palette from, which shows each one as the person moves to it. … The author agent is the Chat's own agent, which has binnacle's skill in every session, and its changes go in the person's file. The colour sets from pi, and the person's own pi themes, are in the list." It serves outcomes 1 to 5, and 11: a person picks a palette and sees it as they move; changes any colour in a file of their own; asks the author agent for a change that goes in that file; keeps their changes across palettes; and sees the terminal's own colours until they pick. An author adds a place that palettes come from. It builds on [`colour-names`](../colour-names/spec.md): the Tones, the Hues, `like` and each feature's own Tones.
- **Status:** built

## Problem

A person who wants other colours must ask for a plugin. There is no file of their own to write a colour in, and no list of palettes to pick from. A plugin's theme layer ranks as an author's, so a colour that a person chose in a plugin loses to any author's layer loaded after it, against the Intent's "What a person chooses always wins over what a feature sets."

A person who uses pi has its `dark` and `light` sets, and maybe their own in `~/.pi/agent/themes/`. binnacle reads none of them.

The Chat's agent does not know binnacle. A person who asks it for "the errors on tool cards in orange" gets an answer about a file it guesses at.

## Behaviour

1. A person writes a colour for a Tone in `palette.json` in binnacle's profile, and binnacle draws in it at the next start.
2. A person saves `palette.json` while binnacle runs, and binnacle draws in the new colours at once.
3. A colour in `palette.json` wins over each plugin's theme layer, a built-in's or an author's, whichever loads last.
4. A Hue in `palette.json`, such as `"hues": { "orange": "#ff8700" }`, changes each Tone in it, as a layer's Hue does.
5. A `palette.json` that is not JSON, or that names a colour that is not one, leaves binnacle in the colours it had, and the status line says what is wrong and where.
6. When `palette.json` is mended, the colours follow it, and the status line's warning goes.
7. With no `palette.json`, or an empty one, binnacle draws in the terminal's own colours, as before.
8. A person runs `/palette`, and a List of palettes opens above the composer, the one in use marked: `Terminal`, then pi's `dark` and `light`, then each of the person's own pi themes by its file's name.
9. A person moves the mark to a palette, and binnacle draws in it at once, with the person's own colours over it.
10. A person presses enter on a palette that loaded, and the palette is kept: `palette.json` names it, and the List closes.
11. A person presses esc, and binnacle draws in the palette that `palette.json` names, and the file does not change.
12. A person picks another palette, and each of their own colours that names a Hue follows the new palette's Hue, and each exact colour stays as it is.
13. A person picks `Terminal`, and binnacle draws in its defaults, with the person's own colours over them, and `palette.json` holds no `palette`.
14. pi's `dark` draws each Tone in the colour pi's `dark` gives it, its `vars` read, and each of pi's backgrounds as a background.
15. A pi theme's `vars` named as a Hue, such as `red`, or `violet` for `magenta`, give the palette that Hue. Each other Hue is the terminal's own.
16. The mark on a palette that does not load, such as a pi theme that is not JSON, shows what is wrong beside it, and binnacle keeps the colours it drew.
17. Enter on a palette that does not load keeps the List open and the file as it was.
18. A pi theme is read only when the mark moves to it, or when `palette.json` names it at start.
19. A `palette.json` that names a palette that is not there, or that does not load, draws as `Terminal`, with the person's own colours, and the status line says which palette and why.
20. A person picks a palette while `palette.json` on disk holds a mistake, and binnacle does not write the file, and the status line says what is wrong.
21. A pick writes `palette` into the file as it is on disk once its palette has loaded, so a colour saved while it loaded is kept.
21a. Esc while a pick waits ends it: the file does not change, and the List closes.
22. An author adds a place that palettes come from, with `binnacle.palettes(source)`, and its palettes are in the List after pi's.
23. A second source of a name that is taken is refused, and the error names it.
24. A palette that its source loads after the mark has left it is not drawn, even when the mark has come back to it and a newer load drew it.
25. The Chat's agent has binnacle's skill in its catalog in every session, and the skill tells it to change a person's colour in `palette.json`.
26. A person asks the Chat's agent to make the errors on tool cards orange, and the agent loads the skill, writes `"transcript.card.error": "orange"` in `palette.json`, and the card's exit status is orange once it saves.

## Journeys

1. **Pick a palette, and change your mind.** Start binnacle, and ask the agent for an answer with a heading, a quote and some code, then to run `exit 3`. Run `/palette`. A List opens above the composer: `Terminal`, marked, then `dark` and `light`, each with `pi` beside it. Press down: the transcript, the composer's rules and the status line draw in pi's `dark` at once, and the heading is pi's yellow. Press down: they draw in pi's `light`. Press esc: the List closes, the Focus is in the composer, and binnacle is in the terminal's colours again. Run `/palette` again, move to `dark`, and press enter: the List closes in `dark`. Quit and start binnacle: it is in `dark`.
2. **Your own colours, across palettes.** Open `~/.dsh/profiles/binnacle/palette.json`. It holds `{ "palette": "pi/dark" }`. Add `"colors": { "mdHeading": "green", "mdQuote": "#ff00ff", "transcript.card.error": "orange" }` and `"hues": { "orange": "#ffaf00" }`, and save. At once, the heading is pi `dark`'s green, the quote `#ff00ff`, and the card's `exit 3` `#ffaf00`. Run `/palette`, and move to `light`: the heading is pi `light`'s green, the quote stays `#ff00ff`, and `exit 3` stays `#ffaf00`. Move to `Terminal`: the heading is the terminal's green, and the quote and `exit 3` stay. Press esc: binnacle is in `dark` again.
3. **A save while the List is open.** Run `/palette`, and move to `light`. In `palette.json`, change `mdQuote` to `#00ffff`, and save: the quote is `#00ffff` at once, still in `light`. Press esc: binnacle is in `dark`, with the quote `#00ffff`.
4. **A mistake in the file.** In `palette.json`, change `#00ffff` to `#00fff`, and save. The colours stay. The status line says `palette.json: the Tone mdQuote is not a colour: '#00fff'`. Run `/palette`, and press enter on `light`: the file does not change, and the warning stays. Press esc. Put `#00ffff` back, and save: the warning goes.
5. **A Request while you look.** Ask the agent to write a file in `/tmp`, so it asks for an approval, and run `/palette` before it asks. Move to `light`. When the Request comes, it stands in the composer's place, and the List goes with the composer. Approve it. The List is back, `light` marked, and down and up move its mark. Press esc.
6. **Ask the agent.** In the Chat, type `make the errors on tool cards orange`. The agent loads binnacle's skill, then writes `"transcript.card.error": "orange"` under `colors` in `palette.json`, beside your own. Once it saves, the card's `exit 3` is orange, and the transcript's `✗` line of a failed read is still in `error`. Delete the line, and save: `exit 3` is in `error` again.
7. **A pi theme of your own.** Copy pi's `dark.json` to `~/.pi/agent/themes/mine.json`, and set its `accent` to `#ff8700`. Run `/palette`: `mine` is listed after `light`. Move to it: the marked item in the List is `#ff8700`. Press esc. Write `{` at the start of `mine.json`, save, and run `/palette` again: `mine` is listed. Move to it: `not JSON` shows beside it, and binnacle keeps the colours it had. Press enter: the List stays open. Press esc.
8. **A palette that has gone.** Set `palette.json`'s `palette` to `pi-themes/mine`, with `mine.json` still broken, and start binnacle. It draws in the terminal's colours, with your own over them, and the status line says `palette.json: pi-themes/mine: not JSON`. Delete `mine.json`, and start binnacle again: the status line says `palette.json: no palette pi-themes/mine`.

## Seams

- **The terminal**, through `@easeshine/binnacle/testing`'s mount: the drawn rows and each cell's style.
- **`palette.json`**, in a profile folder of the test's own, which the mount gives the plugins as dsh's `profileContext`. A test writes it, and reads what binnacle writes. The mount has no `profileContext` today: Part 1 adds an option for it.
- **A pi folder of the test's own**, through `PI_CODING_AGENT_DIR`, as pi reads it.
- **Keys**, through the mount: `/palette`, down, up, enter and esc.
- **dsh's `skills`**, through the mount: the catalog's entry for binnacle's skill, and its body. The mount loads no skill registry today: Part 3's test loads dsh's `skill` row beside binnacle's.

## Decisions

1. **The person's file is `palette.json`, in binnacle's profile folder**, beside `cordis.patch.yml`, as `profileContext.dir` gives it. It is JSON, as pi's themes are, so an agent and a person both write it with no new syntax:

   ```json
   {
     "palette": "pi/dark",
     "hues": { "orange": "#ff8700" },
     "colors": { "transcript.card.error": "orange", "mdHeading": { "color": "green", "bold": true } }
   }
   ```

   `palette` names the palette in use, as `<source>/<name>`. With no `palette`, the palette is `Terminal`, whose id is `terminal`: binnacle's defaults. `terminal` has no slash, so no source's palette is named so. `hues` and `colors` are a theme layer's. Each key may be left out.
2. **The core holds the person's file, and no plugin ranks above it.** The core reads and watches `palette.json`. Its `hues` and `colors` lie over every plugin's layer, and the palette that it names lies between them and the plugins' layers. No API gives a layer either place, so no feature can draw over a person's choice. A feature's own Tone that the palette does not name keeps its `like`, so it follows the palette.
3. **An author shows and picks a palette through the core.** `binnacle.palette` is a Model, `{ inUse, shown, error }`: the id that the file names, the id drawn now, and what is wrong with the file or with its palette. `binnacle.showPalette(id)` draws a palette, or `undefined` for the one in use, and writes nothing. It gives a Promise that resolves once the palette draws, and rejects with what is wrong when it does not load, or when a later call or a save took its place. `binnacle.pickPalette(id)` loads the palette, then writes its id to the file, `terminal` by taking `palette` out. It gives a Promise that resolves once both are done, and rejects with what is wrong, writing nothing, when the palette does not load or the file does not pass the checks. The core, not the caller, checks both. So the List is a plugin, and an author can make another way to pick, as a person's own choice.
4. **A pick reads the file once its palette has loaded.** When the load resolves, a pick whose request is no longer the newest (Decision 8), as after a mark, an esc, or a save that changed `palette`, rejects and writes nothing. Else `pickPalette` reads `palette.json` from disk then, at once before its write. If it is not JSON, or does not pass the checks of Decision 6, the pick writes nothing, and `error` names the mistake. Else it sets `palette`, keeps each other key as it was on disk, and writes the file with two spaces of indent. A write that fails sets `error`, and the colours do not change.
5. **The file is watched by its folder.** An editor often saves by a rename, which an `fs.watch` of the file loses. The core watches the profile folder for `palette.json`, and reads it again 50 ms after the last change, so a save in parts is read once.
6. **A mistake keeps the last good colours.** A file that is not JSON, a key that is not one of the three, a Hue not in the list, a colour that is not one, or a `like` loop leaves the colours as they were, and sets `error` to `palette.json: ` and what is wrong. A file mended clears it. The status line draws `error` in the segment `status.palette`, in `status.error`, and nothing while there is none.
7. **A palette comes from a source.** A source is `{ name, list, load }`. Its `name` has letters, digits and `-`, and a source of a name that is taken is refused. `list()` gives a Promise of its palettes, `{ name, description? }[]`, without reading them; a palette's id is `<source>/<name>`, and of two by one name in a source, the first is kept. `load(name)` gives a Promise of a theme layer of `hues` and `colors`, or rejects with what is wrong, in one line. `binnacle.palettes(source)` adds one, as an author's registration, and it goes when its plugin unloads. The List shows binnacle's sources first, then each author's, in the order of registrations.
8. **A load that comes late is dropped.** Each call of `showPalette` and `pickPalette`, each save that changes `palette`, and the start each begin a request of their own, and only the newest request draws. A load of an older request, even of the same id, is not drawn, and its rejection sets no `error`. A load whose source has gone since it began is not drawn either. A List's `list()` is read for the open of the List that asked, and is dropped once the List has closed. A load that rejects leaves the colours drawn as they were, and `shown` stays.
9. **At start, the core waits for the named palette before it first draws, for at most 100 ms**, as pi waits for a terminal's colours. A palette that has not drawn by then draws as `Terminal`, with the person's colours, and sets no `error` while it waits. Its load is the start's request: if no later request began, it draws when it comes, or a source that registers later with it draws it then, and either clears `error`. A palette whose source is not registered once binnacle has drawn sets `error` to `palette.json: no palette <id>`, which a source that registers later clears. One that does not load sets `palette.json: <id>: ` and why, and one whose load has not settled 5 seconds after start sets `palette.json: <id> did not load`. Each draws as `Terminal`, with the person's colours.
10. **The palette's row, `binnacle-palette`, gives the sources and the List.** It registers `pi` and `pi-themes`, `/palette`, and the List. With the row off, `palette.json` still applies, `/palette` is no command, and a file that names a palette of `pi` draws as `Terminal`, with the status line saying `no palette pi/dark`.
11. **pi's `dark` and `light` are copied**, with credit, as pi-tui's code is, so binnacle does not need pi installed. They are read as pi reads a theme: each `vars` reference followed, a loop or a missing var an error; `""` is the terminal's own, `{}`; a number is an index of 256; each of pi's colours whose name ends in `Bg` is a `background`, and each other a `color`. `export` and `appearance` are not read: a light and a dark version are Stage 3.
12. **The person's own pi themes are `*.json` in pi's themes folder**, `$PI_CODING_AGENT_DIR/themes`, or `~/.pi/agent/themes` with no such variable, as pi finds them. A theme's name, and its id, `pi-themes/<name>`, are its file's name without `.json`: the List names it without reading it. The folder is read when `/palette` opens, and a file only when the mark moves to it, or when the file names it at start. A theme's own `name` is not read.
13. **A palette's Hues come from its `vars` by name.** A var named as a Hue gives it, and pi's `violet` and `purple` give `magenta`. Each other Hue is the terminal's own, so a person's colour in `orange` is the colour 208 in a palette that names none.
14. **The List is the Kit's List, in a Layout above the composer**, as the offer of commands is: the Layout `palette`, the List `palette.list`, at most 9 rows under a rule, each row cut at the width with `more`, as the offer cuts its rows. The Chat stays in view, so a person sees their own session change as the mark moves. Each item is the palette's name, with its source as its description, and what is wrong after it once the mark has been on it. The mark starts on the palette in use. Up on the first goes to the last, and down on the last to the first, as each List does. On a terminal too short, the transcript gives up its rows first, as for the offer. A Request that stands hides the List with the composer. The Focus is in the List while it is open, as it is in the List of the offer, and back in the composer when it closes.
15. **Enter waits for its pick, and esc ends the wait.** Enter runs `pickPalette` on the marked palette, and while it waits, the List takes no move and no enter, so a pick is never of a palette the person did not see. Esc still works: it runs `showPalette(undefined)`, a newer request, so the pick rejects and writes nothing, and the List closes, as esc closes it. A Request that comes stands as it does with no pick. A pick that resolves closes the List. One that rejects for its palette or the file keeps the List open, with the reason beside the item, or in the status line for the file's mistake.
16. **Esc shows the palette that the file names.** It runs `showPalette(undefined)`, so a palette that the person or the agent saved while the List was open is kept.
17. **binnacle's skill is in the Chat's agent's catalog by a provider of its own.** The row `binnacle-skill` loads dsh's `skill-filesystem` with `{ providerName: 'binnacle', includeDefaultRoots: false, customSkillDirs: [<the package's skills/>], watch: false }`, so the skill's paths to the docs resolve as they do on disk. The catalog holds each skill's name and description, and the agent loads the body when a request matches it, as dsh's `tool-skill` asks. So the skill's description names a change to binnacle's colours, keys, layout and features, and its section on colours sends a person's colour to `palette.json`, at `$DSH_PROFILE_DIR/palette.json`, which dsh sets in the agent's shell, and never to a plugin. One skill costs one line of the catalog until the agent loads it.

## Edges

| Edge | Answer |
|---|---|
| No `palette.json`, or `{}` | Behaviour 7 |
| A file that is not JSON, or holds a colour that is not one | Behaviours 5, 6, Decision 6 |
| A file saved in parts, or by a rename | Decision 5 |
| The file deleted while binnacle runs | As no file: the defaults, Behaviour 7 |
| A save just before a pick, within the 50 ms | Behaviour 21, Decision 4 |
| A pick while the file on disk holds a mistake | Behaviour 20 |
| A write that fails | Decision 4 |
| A palette named that is not there, or does not load | Behaviour 19, Decision 9 |
| A palette that does not load, marked, or picked | Behaviours 16, 17 |
| A theme deleted between the List and the mark | Its load rejects: Behaviour 16 |
| A source that registers after start | Decision 9 |
| No pi themes folder, or an empty one | The List holds `Terminal` and pi's two |
| A source that throws in `list` | The List shows the source's name with the error, and the other sources' palettes |
| Two sources by one name, two palettes by one name | Behaviour 23, Decision 7 |
| A load that comes after the mark moved on, or after the mark came back to it | Behaviour 24, Decision 8 |
| A load whose source unloads while it waits | Not drawn (Decision 8) |
| A load at start slower than 100 ms, or that never settles | Decision 9 |
| A save, or a mark, while the start's load waits | The newer request wins (Decisions 8, 9) |
| Enter while the mark's palette still loads, or a load that never settles | Decision 15: esc ends the wait |
| A save, a mark or an esc while a pick's load waits | The pick writes nothing (Decision 4) |
| `Terminal` picked, and its id | Behaviour 13, Decision 1: the file loses `palette` |
| More palettes than 8 rows | The List scrolls, as the offer of commands does |
| A long name, or a long error | The row is cut at the width with `more` (Decision 14) |
| The first item, the last, and a move past them | Decision 14: the mark goes round |
| A terminal too short | Decision 14 |
| `/palette` while the List is open | It moves the mark to the palette in use |
| The person or the agent saves while the List is open | The person's colours follow at once; esc shows what the file names (Decision 16) |
| A Request comes while the List is open | It stands in the composer's place and hides the List; when it goes, the List is back with its mark and the Focus |
| A stored session | The file applies; `/palette` is not offered, as no command is |
| A source's plugin unloads while its palette is in use | The palette draws as `Terminal`, and `error` says it is not there (Decision 9) |
| The palette's row off | Decision 10 |
| After it: the Focus | Back in the composer on enter and on esc |
| Beside the offer of commands | The `/` of `/palette` closes the offer as the command runs, then the List opens in its place |
| A terminal of 256 colours | Each exact colour of a palette draws as the nearest of 256 |

## Out of scope

- VS Code themes, a palette's light and dark versions, and a background behind the whole screen: Stage 3.
- pi's `system` palette, which asks the terminal for its colours: a feature of its own.
- A search in the List: a few palettes need none, and Stage 3's many themes bring it.
- Glyphs, edges and spacing in `palette.json`: a palette holds only colours.
- A watch of a pi theme's file: a change to one is read at the next mark on it, or the next start.
- Asking for a change from inside binnacle with an author agent of its own, `/preset`: the authoring Intent's Stage 5.

## Parts of the build

1. **A person's colours, in a file of their own.**
   - Behaviours 1 to 7. Before the build, at `origin/main`: binnacle reads no `palette.json`, so each test fails at its first assertion on a cell's colour, or on the status line's warning.
   - Code: `src/api.ts` (the Model `palette`), `core/theme.ts` and `core/service.ts` (the person's layer over every plugin's), a new `core/palette-file.ts` (the file, the watch, `error`), `plugins/status-line/` (`status.palette`), and `src/testing/` (the mount's profile folder, given as `profileContext`).
   - Records: the `AGENTS.md` of `src/core/` and of the status line, a new `use/colours.md`, its row in `use/index.md`, `author/concepts/theme.md` (the person's file, over every layer), `author/built-ins/status-line.md`, and a changeset, a `patch`.
2. **A person picks a palette from a list, and sees it as they move.**
   - Behaviours 8 to 24. Before the build, `/palette` is no command, there is no source, and `showPalette` and `pickPalette` do not exist, so each test fails at its first assertion on the List's rows, a cell's colour, or the file. After Part 1.
   - Code: `src/api.ts` (`palettes`, `showPalette`, `pickPalette`), the core's palette in use, a new row `src/plugins/palette/` (the sources, the pi reader, the List, the command) and its row in `cordis.patch.yml`, and pi's two themes, copied under `src/terminal/pi/`.
   - Records: the row's `AGENTS.md`, `use/colours.md`, a new `author/built-ins/palette.md`, its row in `author/index.md`, `author/concepts/theme.md` (a source), `NOTICE` for pi's themes, and a changeset, a `patch`.
3. **The Chat's agent changes a person's colours.**
   - Behaviours 25 and 26. Before the build, the catalog has no skill of binnacle's, so 25 fails at its assertion on the catalog. 26 is Journey 6's: the test of 25 reads that the skill's description names colours, and that its body names `palette.json` and `$DSH_PROFILE_DIR`. After Part 2, as both change `use/colours.md`.
   - Code: a new row `src/plugins/skill/`, its row in `cordis.patch.yml`, and the description and the colours section of `skills/binnacle/SKILL.md`.
   - Records: the row's `AGENTS.md`, `use/colours.md` (ask the agent), a new `author/built-ins/skill.md`, its row in `author/index.md`, and a changeset, a `patch`.

## Door

Two-way: every PR is two-way before 1.0, as `.agents/doors.md` says.
