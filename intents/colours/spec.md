# Spec: a line filled with a colour

- **Intent:** [Colours](intent.md), Stage 1, *A line filled with a colour*. It serves outcome 10: an author "fills a line with a colour across its full width, as for a card, or for a line added to a file."
- **Status:** built

## Problem

An author who draws a card cannot put a colour behind its lines. A Style has a colour and five attributes, and no background, so `binnacle.paint` cannot draw one, and a theme layer cannot give a Tone one.

An author who writes the escape code by hand still gets a strip as wide as the text, not the line. The core pads each row of a Place with spaces after the row's reset (`core/layout.ts`, `Arrangement#place`), and `frame` pads each line after a reset too (`kit/frame.ts`). So the author must measure each line and pad it to the width before painting it, and wrapping breaks that padding.

## Behaviour

1. An author fills a line with a Style's background, `binnacle.fill({ background: 'blue' }, 'text')`, and the background reaches the right edge of the line's Place.
2. An author fills a line with a Tone that a theme layer gives a background, `binnacle.fill('muted', 'text')`, and the background follows the theme.
3. An author paints text on a background with `binnacle.paint`, and the background stops where the text stops, on each row that the text wraps to.
4. An author fills a line with a Tone that has no background, and the line draws as `paint` draws it, with nothing behind the rest of the row.
5. An author paints text inside a filled line, in a Tone or a Style with a background of its own, and the fill draws again after it, to the edge.
6. An author fills an empty line, and a whole row of the background draws.
7. An author fills a line longer than its Place, and each row that it wraps to fills to the edge.
8. A line that ends with a colour, bold, dim, italic, underline or inverse still open still draws the rest of its row plain: only a fill goes on past the text.
9. An author fills a line in a `frame`, and the background reaches the frame's inner edge, and the edge keeps its own Tone.
10. A filled row in a box stops at the box's content: the box's padding and edges draw as they did.
11. A float over a filled row leaves the fill on each side of it.
12. A person who copies a filled row gets its text with no spaces at its end.
13. An author whose theme layer changes the fill's Tone sees the fill in the new colour, and in the old one again when the layer goes.
14. A theme layer that gives a Tone a background that is not a colour is refused, and the error names the Tone. `paint` and `fill` with a Style whose background is not a colour throw.
15. A filled line in a separated row draws its background only as far as its text.

## Journeys

The Journeys use one plugin in the profile, the card plugin. It adds a theme layer that gives `muted` the background `bright-black`, and three commands.

1. **A card of the author's own.** Run `/card`. A Screen of the plugin's own shows a card, one line each:
   - an empty filled line;
   - a filled line with a bold title in `accent`;
   - a filled line with one word painted in a Style with the background `red` in the middle of it;
   - a filled line of text longer than the terminal;
   - a line painted in `muted` with `paint`, longer than the terminal;
   - a line that writes an underline's code and never closes it;
   - an empty filled line.

   The filled lines are one block of `bright-black` from the left edge to the right. The red word is red, and `bright-black` goes on after it to the edge. The long filled line wraps, and each of its rows is filled. The painted line wraps too, and on each of its rows the background stops where the text stops. The underlined line's underline stops at its text. Make the terminal narrower, then wider: the block follows the width each time.
2. **Copy from the card.** On the card's Screen, drag across the long filled line, and let go. The Selection draws over the text in the `selection` Tone. Paste into another program: the text comes with no spaces at the end of a row. Press esc: the Chat is back, as it was.
3. **The theme changes the card while it shows.** Run `/card`, and press `t`, which the plugin binds to a second layer that gives `muted` the background `#3a3a5a`. The block takes that colour at once, or the nearest of 256 where the terminal has no truecolor. Press `t` again: the second layer goes, and the block is `bright-black` again. Press `u`, which takes out the first layer too: the card draws in `muted` with nothing behind it, and its lines stop where their text stops.
4. **A card in a box, under a float.** Run `/card-box`. The Screen draws the card in a box with a padding of 1 and a border, and a float of one line, `a note`, over its middle. The fill reaches the inner side of the padding: the padding and the border have nothing behind them. On each side of the float, the filled rows go on in `bright-black`. Then change the card plugin to draw the card in a `frame`, and restart binnacle: the fill reaches the frame's inner edge, and the edge draws in `border`, with nothing behind it.
5. **Beside the status line.** The card plugin also adds a status segment, `card`, filled in `muted`. In the Chat, the segment's background covers its text only, and the divider after it has nothing behind it.
6. **A colour that is not one.** Change the plugin's first layer to give `muted` the background `'36'`, and restart binnacle. The plugin does not load, and its error names `the theme's muted`. Put `bright-black` back.

## Seams

- **The terminal**, through `@easeshine/binnacle/testing`'s mount: a plugin's theme layer, Part and Layout in. Out come the drawn rows, and each cell's style, whose `background` already reads the terminal's.
- **The copy's text**, as the `copy` plugin's tests read it after a drag and a release.

## Decisions

1. **`fill` is its own call, beside `paint`, not an attribute of a Style.** A Style says how a colour looks, and a Tone is shared by many draws. A fill says where a line ends. A Tone that filled would fill each line drawn in it, such as a description in `muted`.
2. **The core holds one rule, read on the whole line before it wraps: a line whose background is still open at its end is filled.** Each row of a filled line goes on to its end in the background that is open at the row's end. A line whose background closes before its end is not filled: before each of its rows is padded, the background is closed too, so a painted background stops at its text on every row it wraps to. `fill` paints as `paint` does, and leaves the background open at the end. Each place that pads a row follows the rule: a Place's rows, a float's rows, and `frame`'s lines, which `frame` wraps itself. A line with a raw escape code that leaves a background open fills too, as the rule is about the line, not about who wrote it.
3. **Only a fill goes past the text.** Before the core pads a row, it closes each other style that is still open: the colour, bold, dim, italic, underline and inverse. An underline left open by a mistake does not run to the edge. The core does this today by a reset before the padding, so Behaviour 8 is kept, not added.
4. **The key is `background`, as the test kit's `CellStyle` names it.** A sixteen's background is its own code, `40` to `47` and `100` to `107`, so the person's palette decides how it looks, as for a colour. An exact colour is drawn as the nearest of 256 where the terminal has no truecolor, through the copied colour code's `background` branch.
5. **A painted background is closed by `49`.** `paint` opens its style again after an inner `49`, as it does after each other close, so the outer background draws on after an inner one.
6. **This Stage adds no Tone, and changes no default.** pi's background Tones come with pi's whole set in Stage 2, when a Tone can name a Hue and the default Palette can give each a colour that reads. Until then, an author fills with a Style, or with a Tone that their own theme layer gives a background.
7. **A fill reaches the content of what holds it, and no further.** A Place's row ends at its content box, so a box's padding and edges stay as they are. `frame` has no padding, so a fill there reaches the inner edge. A separated row cuts each child to its first line, joined by dividers, so a fill there stops at its text, and no divider takes it.
8. **An empty fill is a row of the background.** `fill(given, '')` opens the background with no text, so that a card's blank lines fill. `paint(given, '')` still gives `''`.
9. **The kit's `wrap` and `indented` do not fill their indent.** Their indent is drawn before the line's text, so the fill starts at the text on each row after the first. An author who wants the indent filled fills the line after it is wrapped or indented.

## Edges

| Edge | Answer |
|---|---|
| A Tone with no background | Behaviour 4 |
| An empty line | Behaviour 6, Decision 8 |
| A line longer than its Place | Behaviour 7 |
| A painted background that wraps, with no fill | Behaviour 3, Decision 2 |
| A wide character that leaves one cell at a row's end | The cell is padded in the background, as Behaviour 1 |
| A Place one cell wide | Each row is one cell of the fill, as Behaviour 7 |
| A style other than the background left open | Behaviour 8, Decision 3 |
| A background inside a fill | Behaviour 5, Decision 5 |
| A box's padding and edges | Behaviour 10, Decision 7 |
| A `frame` | Behaviour 9 |
| A separated row | Behaviour 15, Decision 7 |
| A float over a filled row | Behaviour 11 |
| The theme layer comes or goes while the fill shows | Behaviour 13 |
| A colour that is not one | Behaviour 14 |
| A copy of a filled row | Behaviour 12 |
| The Selection and the Mark over a fill | Each is drawn over its cells as before. The Selection's `selection` Tone is `inverse` by default, which swaps the fill and the text. |
| A terminal of 256 colours | Decision 4 |
| The indent of `wrap` and `indented` | Decision 9 |
| After it: the Focus and the keys | A fill changes no key, no click and no Focus |

## Out of scope

- The background Tones of pi, and their defaults: Stage 2, with pi's whole set.
- A colour behind the whole screen: Stage 3.
- A plugin's own colours, such as `tool-cards.error`: Stage 2.
- A built-in that draws with a fill, such as tool cards drawn as cards. Each built-in takes it up in a change of its own, once its Tones exist.
- `NO_COLOR`: the product's Stage 6.

## Parts of the build

1. **An author fills a line with a colour across its full width.**
   - Behaviours 1 to 15. Before the build, at `origin/main`: `fill` does not exist, a Style's `background` draws nothing, and a theme layer with a `background` that is not a colour loads. So each test of Behaviours 1 to 7 and 9 to 15 fails at its first assertion on a cell's `background`, on the call to `fill`, or on the refusal. Behaviour 8 holds already: its test guards the reset before the padding, which Decision 2 must keep.
   - Code: `src/api.ts` (`Style`, `Binnacle#fill`), `core/theme.ts` (the background, `fill`, and `49` in the closes), `core/layout.ts` and `kit/frame.ts` (the padding), and the copied colour code's `background` branch.
   - Records: the `AGENTS.md` of `src/core/` and `src/kit/`, `author/concepts/theme.md`, `frame` in `author/concepts/parts-places-screens.md`, and a changeset, a `patch`.

## Door

One-way: it changes what an author may import. `Style` takes `background`, and `Binnacle` takes `fill`.
