# Palettes

The row `binnacle-palette` gives the sources of pi's palettes, the command `/palette`, and the List that a person picks a palette from. The core holds the person's palette and the sources: [the theme](../concepts/theme.md#a-palette-and-its-sources) says how to show, pick and add one.

- It adds two sources with `binnacle.palettes(source)`. `pi` has pi's own `dark` and `light`, copied into binnacle. `pi-themes` has each `*.json` in pi's themes folder, `$PI_CODING_AGENT_DIR/themes`, or `~/.pi/agent/themes` with no such variable, by its file's name. The folder is read each time the List opens, and a theme only when it is loaded.
- A pi theme is read as pi reads it. A theme without each colour that pi asks of a theme does not load, and says which it has not. A colour that pi lets a theme leave out takes pi's fallback, as `thinkingMax` takes `thinkingXhigh`. Each `vars` reference is followed, and a loop or a missing var is an error. `""` is the terminal's own colour. A number is a 256-colour index. Each of pi's colours whose name ends in `Bg` is a `background`, and each other a `color`. A var named as a Hue, such as `red`, gives the palette that Hue, and `violet` and `purple` give `magenta`. Each other Hue is the terminal's own, whatever a plugin's layer gives it. `export` and `appearance` are not read.
- `/palette` is a command of dsh's, which the row registers with `ctx.commands.register`. It runs the action `palette.open`.
- With the row off, `palette.json` still applies, `/palette` is no command, and a file that names a palette of `pi` draws in the terminal's colours, with the status line saying `palette.json: no palette pi/dark`.

The List is the Layout `palette`. The row puts it in the Chat with this edit, so a Request that stands hides it with the composer:

```js
ctx.binnacle.edit('chat', { insert: { layout: 'palette', size: 'content', unless: 'request' }, before: 'composer' })
```

The Layout is `PALETTE_LAYOUT`, from `@easeshine/binnacle/plugins/palette`, frozen: the List `palette.list`, at most 9 cells with its rule, so 8 rows:

```js
{ place: 'palette.list', size: { most: 9 }, border: ['top'] }
```

- The model `palette.picker`, of the type `PalettePickerState`, holds `open`, whether the List is open; `items`, its palettes; `wrong`, what is wrong with each palette that did not load, by its id; and `picking`, whether a pick waits. Each item is `{ id, label, description }` of the type `PaletteItem`: `id` is the palette's id, `label` its name, and `description` its source, then ` · ` and the palette's own description. A source whose `list()` fails is one item with no `id`, its name as its `label` and the error as its `description`.
- The actions:
  - `palette.open`: no keys. `/palette` runs it. It opens the List with `Terminal`, then each source's palettes in the order of the sources, the first of two by one name kept, and marks the palette in use. It moves the Focus to `palette.list`. On a List that is open, it marks the palette in use again.
  - `palette.close`: esc, in `palette.list`. It runs `binnacle.showPalette(undefined)`, so binnacle draws the palette that the file names, and a pick that waits writes nothing. It closes the List, and moves the Focus to `composer.input`.
  - `palette.list.up`, `palette.list.down` and the rest are the List's. Each mark that a person moves runs `binnacle.showPalette(id)`. Enter, `palette.list.pick`, runs `binnacle.pickPalette(id)`. While the pick waits, the row takes no move and no pick. A pick that resolves closes the List. One that rejects keeps it open, with the reason beside the palette, or in the status line for a mistake in the file.
- A palette is drawn by the List's pieces, `palette.list.mark`, `palette.list.label` and `palette.list.description`, of the type `ListPiece<PaletteItem>`. The whole row is the Look `palette.list.row`, of the type `PaletteRow`. The row sets it to draw what is wrong in `error` after the palette, and to cut the row at the width with the `more` glyph.
- When a Request goes, the List takes the Focus back, while it is open.

To float the List over the transcript, move it, and frame it:

```js
import { PALETTE_LAYOUT } from '@easeshine/binnacle/plugins/palette'
ctx.binnacle.layout('palette', { ...PALETTE_LAYOUT, border: true })
ctx.binnacle.edit('chat', { move: 'palette', over: 'transcript', at: { side: 'center' } })
```
