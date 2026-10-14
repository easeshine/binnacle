# Spec: select and copy

- **Intent:** [Select and copy](intent.md), for the product's Stage 4, *Polish*: "The Maintainer selects and copies text with the mouse, as in a plain terminal." It serves outcome 3 of the [product Intent](../binnacle/intent.md): "Read, fold, search and copy everything in the session."
- **Status:** built

## Problem

A person drags across an answer to copy a path, and nothing is selected. binnacle asks the terminal for mouse reports in the core's `Host`, so the terminal stops selecting by itself. The core's `route` reads only a press and the wheel, and does nothing with a drag or a release.

The way out is the terminal's own bypass, such as shift and a drag. Few people know it, and it selects across the whole screen, the composer and the status line with the answer.

An author cannot change how text is copied, cannot copy with a key, and cannot give the mouse back to the terminal.

## Behaviour

1. A person drags across the transcript and sees the cells from the press to the pointer drawn in the theme's `selection` Tone, inverse by default. Nothing else changes.
2. A person who lets go after a drag has the selected text copied: one line for each row, as drawn, with no colour and no spaces at a row's end. They see `copied` in the status line for two seconds, or `sent to the terminal` when only the terminal was asked to copy (Decision 9).
3. A person who presses and lets go on one cell clicks it, and the click acts on the release: a tool card's first line folds, and nothing is selected.
4. A person who presses on a tool card's first line and drags selects, and the card does not fold.
5. A drag that leaves the Place where it began selects to that Place's edge: the Selection never holds a row of another Place, nor its box.
6. A person who holds a Selection keeps it while they type, press esc, turn the wheel, or see new output come below it. Each key does what it did before.
7. The next press anywhere clears the Selection. So do a resize, another Screen shown, and any change to the text of a row that it covers, such as a fold above it.
8. A drag that begins in a node with `mouse: false`, or on no Place, selects nothing, while another Place takes the mouse. There, the terminal's own bypass, such as shift and a drag, selects (Decision 13).
9. A drag that begins over a float, such as the offer of commands, selects in the float's Place.
10. An author reads the Selection from the core's model `selection`: its Place and its text, or `undefined` with none.
11. An author binds the action `copy.selection` to a key: a release copies nothing, the key copies the Selection, and with no Selection the key goes on to the next action.
12. An author sets the action `copy.selection` with a `run` of their own: a release runs it, and binnacle's clipboard is not written.
13. A copy that fails says why in the status line for five seconds, such as `copy failed: too long for the terminal`.
14. A copy reaches the system's clipboard through the system's own tool:
    - `pbcopy` on macOS;
    - PowerShell on Windows, and in WSL with no display;
    - on Linux, `termux-clipboard-set` in Termux, `wl-copy` under Wayland, then `xclip`, then `xsel`.

    Text that is not ASCII reaches the clipboard whole on each of them. Over SSH or mosh, it also asks the terminal to copy, with OSC 52. Where no tool copies, it asks the terminal instead.
15. A copy whose OSC 52 would be longer than 100 000 bytes of base64, where no tool copied it, fails, and says the text is too long for the terminal.
16. A double click selects a word, and keeps a path or a kebab-case name whole. A triple click selects the Part's line across every row it wraps to. Each is copied on its release. The first click of the run acts as a click. The second and the third only select. A drag after a double click grows the Selection by words, and after a triple click by lines.
17. A drag held above or below its Place scrolls the Place one row every 50 ms, and the Selection grows with it.
18. A Selection under a float, such as the offer of commands, is drawn only where its Place shows, and stays. A float that comes during a drag leaves the drag as it is.
19. An author who sets `mouse: false` on the root of the Screen's Layout gives the mouse back. binnacle asks the terminal for no mouse reports while no Place on view takes the mouse, so the terminal selects by itself. It asks again when a Place takes the mouse.

## Journeys

1. **Copy a path from an answer.** Ask the agent which file holds the composer. Drag across the path in its answer: it is drawn inverse, and the composer and the status line do not change. Let go: the status line says `copied` for two seconds. Paste with the terminal's own paste, such as cmd+v: the path lands in the draft. Send it.
2. **Copy while the agent works.** Send a prompt that makes a long answer. While it streams, press on an earlier answer, and drag below the transcript's last row. The transcript scrolls, and the Selection grows. Let go, and paste into another program: the rows come one per line, without the composer's text.
3. **Fold and select on one line.** Click a tool card's first line: it folds on the release. Press on the same line and drag: it selects, and the card stays folded. Double-click a word in an answer: the word is selected. Triple-click a long paragraph: every row of it is selected.
4. **Keep a Selection while reading.** Select a line of an answer. Turn the wheel down and up: it is still selected. Type in the composer: the keys reach the draft, and the Selection stays. Click a card's first line: the Selection clears, and the card folds.
5. **Copy over SSH.** Run binnacle over SSH on a machine with no clipboard tool, such as a server. Select an answer and let go: the status line says `sent to the terminal`. (On a machine with a working tool, it says `copied`, as the tool copied too.) Paste on the near machine: the text is there if the terminal copies for an app, such as Ghostty, kitty or iTerm2 with it allowed. Then select from the session's first row to its last, past 75 000 characters, with the edge scroll: the status line says `copy failed: too long for the terminal` for five seconds, and binnacle goes on.
6. **Beside the composer, the offer and a Request.** Type two lines in the composer, and drag across them: they are selected. Type a letter: the draft changes, and the Selection clears. Clear the draft. Select the transcript's last rows, then type `/`: the offer of commands floats over them, the Selection is not drawn on the offer's cells, and it shows again when the offer goes. Drag across the offer's rows: they are selected, and no command is picked. Let go, press esc, and send a prompt that makes the agent ask a question. Click a Choice: it is picked on the release. Drag across the Request's text: it is selected, and no Choice is picked. Resize the terminal: the Selection clears.
7. **An author's copying.** Add a plugin to the profile that binds `copy.selection` to ctrl+o. Select and let go: nothing is copied. Press ctrl+o: it is copied, and the status line says so. Press ctrl+o with no Selection: what ctrl+o did before happens. Change the plugin to set `mouse: false` on the Chat's Layout: a plain drag selects as the terminal does, and a click folds nothing. Change the plugin to set `copy.selection` with a `run` that writes the text to a file: select and let go: the file has the text, and a paste gives what the clipboard held before. Add to the plugin a key that shows a Screen of its own: select, press it, and press it again to go back: the Selection has cleared. Take the plugin out: binnacle selects and copies again.

## Seams

- **The terminal**, through `@easeshine/binnacle/testing`'s mount: presses, motions and releases in, as the terminal sends them. Out come the drawn rows, each cell's style and the status line.
- **What a copy reaches**: the mount records each text given to the clipboard, and each OSC 52 written to the terminal.
- **The author API:**
  - the model `selection`, the action `copy.selection` and the gesture `select`;
  - the Tone `selection`, and `Style.inverse`;
  - a Layout node's `mouse`.
- **The clipboard's route**, through the core's own test kit: a fake system (its platform, its environment, the tools that exist and those that fail) in. Out comes the tool that each copy ran, or the OSC 52 it wrote.

## Decisions

1. **A click acts on the release, on the cell where it was pressed.** A press that moves before its release selects and clicks nothing. *Recommended:* this, as pi does. A press-time click would fold a card under every drag that starts on its first line. An ADR records it, `adr/0006-a-click-acts-on-its-release-and-a-press-that-moves-selects.md`, as it binds every Spec that takes a click. Considered: a drag only with a modifier, which leaves a person's plain drag doing nothing.
2. **The core holds the Selection; a built-in row copies it.**
   - The core turns on button-motion reports (`?1002h`). It reads a press, a motion and a release. It keeps the Selection in the Place where the press landed, as rows of the Part's wrapped rows and columns, so that the wheel and new output below it do not move it. It draws it over those rows.
   - The core names the model `selection`, as `{ place, text }` or `undefined`. On a release that ends with a Selection, after a drag, a double or a triple click, it fires the gesture `select` to the actions with no Place, as it fires the wheel's.
   - A new row, `binnacle-copy`, sets the action `copy.selection`, bound to `select`, and enabled only while a Selection is held. It copies the model's text, and names the model `copy` with the outcome of the last copy.
   - The model `copy`'s state is `{ last?: { outcome: 'copied' | 'sent' | 'failed', reason?: string, at: number } }`: the newest copy that finished, `at` on the core's clock when it finished. A copy started after another wins: an older copy that finishes later is dropped. When the row unloads, each tool it still waits on is killed, and the model goes with it.
   - The status line shows the outcome in a segment of its own, `status.copy`, read with `modelOf('copy')`.

   *Recommended:* this. An author changes copying with what they have already: an action, a binding and a model. A person who turns the row off gets a Selection that copies nothing. Considered: a `binnacle.copy` method and a `copyOnSelect` option, as pi has, which add API that an action and a binding already give.
3. **What is copied** is the rows as drawn: from the press's cell on its first row to the pointer's cell on its last, each row made plain and trimmed at its end, joined by `\n`.
   - The two ends are put in order, so a drag up or to the left selects as a drag down or to the right does. Both end cells are in it.
   - A grapheme that is wider than one cell, such as an emoji or a CJK character, is in it whole when either of its cells is, and is painted whole.
   - A drag that moved and ends on the cell it was pressed on selects nothing, copies nothing, and clicks nothing. *Recommended:* this, as pi does, for every Part, an author's too. Considered: each Part's source text, such as an answer's markdown, which needs a new field on `Part`. It is out of scope.
4. **How it is drawn:**
   - a Tone `selection`, `{ inverse: true }` by default;
   - `Style.inverse`, which the theme draws as SGR 7;
   - painted over the selected cells only, after the Places are drawn, inside the Place's content box, and only on cells where that Place shows. A float over them keeps its own cells, as ADR 3 holds, and the Selection stays beneath it.

   *Recommended:* this. The Mark inverts a whole event, and only while the transcript has the Focus, so the two read apart. An author changes the Selection with a theme layer, as any Tone.
5. **When it clears** (Behaviour 7): at each draw, the core reads the plain text of the rows that the Selection covers again, and clears the Selection when that text differs from the text it held. A different width, or another Screen on view, clears it too. A clear during a drag ends the drag: its edge scroll stops, and its release copies nothing and clicks nothing. A Selection over a streaming row clears when that row changes. *Recommended:* this. One rule covers a fold above, a card that grows, and a resize, with nothing for a Part to say.
6. **A press with a modifier**, such as shift, selects as a plain press does. A terminal that hands binnacle a shift+drag does not bypass for it. *Recommended:* this. `shift+click` keeps acting on its release.
7. **A double and a triple click** are counted as pi-tui's `getClickCount` counts them: each press within 500 ms of the last, in the same Place, on the same row, and in the same word as the press before. A press on another word starts a new run, and is a first click that acts. A motion, another Screen, or a fourth press starts a new run.
   - The Selection of a double or a triple click is made on its press, and copied on its release (the gesture `select`).
   - A drag after it grows the Selection by whole words or whole lines, as pi's granularity does.
   - A double click selects a word: `Intl.Segmenter`'s word segments that are `isWordLike`, with `/` and `-` joining, as pi joins them.
   - A triple click selects the Part's line across every row it wraps to.

   *Recommended:* this. A person wants the paragraph, and binnacle knows which rows a line wraps to: the core's `Rows`. pi selects one row. The first click acts, so `Part.click` is unchanged.
8. **The edge scroll** runs one row each 50 ms on the core's clock, `internals.later`, while the pointer is held above or below the Place. It stops at the Place's first and last row, and at the release. *Recommended:* this. A terminal sends no motion while the pointer stands still.
9. **The clipboard's route** follows pi's `copyToClipboard`, in its coding agent, copied with credit, without pi's native addon:
   - Each tool is run with no shell, given the text on stdin, and killed after 3 seconds, as pi's `runClipboardCommand` does. The first that exits 0 wins, and a tool that fails or is killed hands on to the next.
   - On Windows and in WSL, the text is written to a UTF-8 file in the temporary folder, readable only by the person, and PowerShell reads it with `[System.IO.File]::ReadAllText(path, UTF8)` into `Set-Clipboard`, killed after 5 seconds. The file is removed after, whatever the outcome. WSL gives PowerShell the file's Windows path from `wslpath -w`. pi does this for WSL, because stdin is read in the console's code page, which breaks text that is not ASCII.
   - OSC 52 is written over SSH or mosh (`SSH_CONNECTION`, `SSH_CLIENT` or `MOSH_CONNECTION`, as pi reads them), and wherever no tool copied. Its base64 is at most 100 000 bytes, as pi's.
   - The outcome is `copied` when a tool copied, `sent` when only OSC 52 was written, as no terminal confirms it, and `failed` when neither could be done.

   *Recommended:* this. It covers Windows and WSL, which the Maintainer asked for.

   **Where it differs from pi, on purpose:**
   - pi runs `clip` on Windows. binnacle uses its PowerShell route there too, for the same code page.
   - pi writes OSC 52 locally only on Linux with no display. The Intent asks for it wherever no tool copies.
   - pi reports an OSC 52 write as copied. binnacle tells the person that it was only sent.
10. **The notice** is `copied`, `sent to the terminal`, or `copy failed: <why>`, in `status.copy`, painted `success`, `muted` or `error`. It shows for two seconds from the copy's `at`, or five for a failure, read from the core's `clock`. It shows nothing otherwise, and takes no divider. *Recommended:* this, as pi flashes "Copied!".
11. **The mouse given back** (Behaviour 19): the core asks the terminal for mouse reports while the Screen on view has a hit that takes the mouse, and turns them off when it has none. *Recommended:* this. The Layout already says where the mouse acts, and an author needs no new switch. Considered: an option of the core's, which says the same thing twice.
12. **The testing kit:**
    - `click` sends a press and its release;
    - `drag(from, to)` sends a press, the motions and a release;
    - `copied` lists each text that reached the clipboard.

    The exported mount's clipboard always works, and the core's own kit fakes the route. *Recommended:* this. An author tests their copy action without a system to fake.

13. **The Intent's Constraint 4**, "Each part of the screen that the mouse does nothing in, by an author's choice, is left to the terminal's own selection", is held as far as a terminal allows. A terminal reports the mouse for the whole screen or not at all. So when no Place on view takes the mouse, binnacle stops the reports, and the terminal selects by itself (Behaviour 19). While another Place takes the mouse, a part where it does nothing is left to the terminal's own bypass, such as shift and a drag, which every terminal of the product's list has. *Recommended:* this. Considered: turning the reports off while the pointer is over such a part, which the terminal cannot tell binnacle once the reports are off. It is taken for the Maintainer, so an ADR records it, `adr/0007-the-terminal-selects-by-itself-only-where-binnacle-takes-no-mouse-on-the-whole-screen.md`, in Part 3.

## Edges

- **At the ends:** a drag past the Place's last line selects to the end of its last row. A drag back to its press cell selects nothing, copies nothing and clicks nothing (Decision 3).
- **With nothing:** a press and a release on one cell, with no motion between, is a click. A Selection of blank rows copies `''`, which is not written, and no notice shows.
- **With too much:** more rows than the Place shows: the edge scroll (Behaviour 17). Wider than the terminal: a row is selected to the Place's right edge. Over the OSC 52 limit: Behaviour 15.
- **When it goes part-way:**
  - The Part in the Place is replaced, or its row unloads: the text changes, and the Selection clears.
  - The Screen changes during a drag: the drag ends, and nothing is copied.
  - A suspend or a quit during a drag ends it, and the terminal is given back as the Host gives it today.
- **When it is another's:** a stored session's transcript selects and copies as a live one does.
- **After it:** the Focus and the keys are where they were. A drag moves no Focus, as [ADR 5](../../adr/0005-a-click-takes-the-keys-only-where-a-person-types-or-picks.md) holds. A person goes on typing.
- **Beside another feature:**
  - a Request's Choices: a click picks on its release, and a drag over them selects their text;
  - a float, such as the offer of commands: a drag begins in the Place under the pointer, the float's first, and a Selection beneath a float is drawn only where its Place shows (Behaviour 18);
  - the composer's draft: a drag selects its rows, and a click still moves no Focus out of the transcript;
  - ctrl+c keeps `binnacle.clear`.
- **Untrusted text:** the rows are made plain before they are copied. OSC 52 carries base64 only, and each tool takes the text on stdin, never in an argument.

## Out of scope

- Copying a Part's source text, such as an answer's markdown (Decision 3), which would need a field on `Part`.
- Pasting with the right or the middle button.
- Opening a link with a click.
- A person's setting for copy-on-select: Stage 5's settings.
- The wheel while the mouse is given back. The terminal decides what it sends then.

## Parts of the build

1. **A drag selects, a release copies, and a click acts on its release.**
   - Behaviours 1 to 13, 15 and 18.
   - The core's Selection, gesture and model.
   - The row `binnacle-copy`, copying through OSC 52 alone, with its limit, its outcome `sent`, and the model `copy`.
   - `status.copy`, the Tone and `Style.inverse`.
   - The kit's `click`, `drag` and `copied`.
   - ADR 6.
   - Records: the `AGENTS.md` of `src/core/` and of a new `src/plugins/copy/`; the docs' `use/keys.md`, `use/status-line.md`, and a new `use/copy.md` with its row in `use/index.md`; the pages for authors of the Focus, the theme, the status line and a new `author/built-ins/copy.md`, with its row in `author/index.md`; the glossary's Selection; a changeset.

   One-way: it adds a Tone, `Style.inverse`, a gesture, a row, and the testing kit's `drag` and `copied`. It changes when a click acts.
2. **A copy reaches the system's clipboard on each system.** Behaviour 14: the tools of Decision 9, their order, the time each is given, the UTF-8 file for PowerShell, and OSC 52 over SSH or where no tool copied. The core kit's fake system. Records: `src/plugins/copy/AGENTS.md`, with where the route differs from pi; credit to pi; a changeset. Two-way: it changes how `binnacle-copy` reaches the clipboard, and nothing an author imports. After Part 1.
3. **Words, lines, the edge scroll, and the mouse given back.** Behaviour 8's bypass note, and Behaviours 16, 17 and 19. ADR 7 (Decision 13). Records: `src/core/AGENTS.md`, the docs' `use/keys.md`, the Layouts page for authors for `mouse`, a changeset. One-way: it changes what `mouse: false` on a Screen's root does for an author. After Part 1.

Part 1 is the thin path through every seam, and a person can copy with it in most terminals. Parts 2 and 3 can be built at the same time: 2 changes the copy row, and 3 changes the core.

## Door

One-way: it adds a Tone, `Style.inverse`, a gesture, the testing kit's `drag` and `copied`, and an ADR. It changes when a click acts. The Maintainer agreed this Spec before it was built.
