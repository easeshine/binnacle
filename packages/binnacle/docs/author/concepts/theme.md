# The theme

The theme is the tokens that everything binnacle draws is drawn with: a colour for each Tone, the glyphs, and a box's edge, padding and gap. An author changes a token once, and everything drawn with it changes.

```js
ctx.binnacle.theme({
  colors: { accent: 'magenta', border: { color: '#5f87af', bold: true } },
  glyphs: { mark: '>' },
})
```

- `binnacle.theme(layer)` adds a layer. Only the tokens that it names change, and the others stay as they were. The newest layer wins for each token. A layer goes when the plugin that added it unloads, and everything is drawn again.
- A colour is one of the terminal's sixteen by name, such as `cyan` or `bright-black`, so the person's palette decides how it looks; a 256-colour index, such as `67`; or an exact colour, as `#rrggbb`, `#rgb`, `okhsl(h s% l%)` or `oklch(l c h)`. An exact colour is drawn as the nearest of 256 where the terminal has no truecolor.
- A Tone's token is a colour, or a Style: `{ color, background, bold, dim, italic, underline, inverse }`. `inverse` swaps the text's colour and the background's. A plain colour stands for `{ color }`, and a Style with no `color` keeps the terminal's own.
- `binnacle.theme` refuses a colour that is not one, such as `'36'`, be it a Tone's colour or its background, and names its Tone.
- `binnacle.tokens` is the tokens as the layers make them now. `binnacle.paint(tone, text)` draws text in a Tone, and `binnacle.paint(style, text)` in a Style of your own, such as `{ bold: true }`, so you need no escape code. A Style's colour or background that is not one makes `paint` throw. A Tone follows the theme, and a Style does not. A Tone or a style painted inside it ends, and the text after it draws in the outer Tone again. Paint in a Part's `lines`, so that the lines follow the theme when it changes:

```js
ctx.binnacle.place('status.state', {
  lines: () => [ctx.binnacle.paint('accent', `${ctx.binnacle.tokens.glyphs.mark} ready`)],
})
```

- `binnacle.fill(given, text)` draws as `paint` does, and leaves the background open at the line's end, so the line fills the rest of its Place's row to the edge, on each row that it wraps to. Fill with a Style, `binnacle.fill({ background: 'blue' }, 'text')`, or with a Tone that a layer of yours gives a background: no Tone has one by default. A fill reaches the content of what holds it: a box's padding and edges draw as they did, a `frame`'s inner edge is where it stops, and a separated row's line fills only as far as its text. `fill(given, '')` opens the background with no text, so an empty line fills its row, and a person who copies a filled row gets its text with no spaces at its end. A background painted with `paint` stops where its text stops, and so does a colour, bold, dim, italic, underline or inverse left open at a line's end: only a fill goes past a line's text. Fill the lines of a card behind their text:

```js
ctx.binnacle.theme({ colors: { muted: { background: 'bright-black' } } })
ctx.binnacle.place('card', {
  lines: () => [
    ctx.binnacle.fill('muted', ''),
    ctx.binnacle.fill('muted', ctx.binnacle.paint('accent', 'A card')),
  ],
})
```

The Tones, what draws with each, and their defaults:

| Tone | Draws | Default |
|---|---|---|
| `text` | text with no other meaning | the terminal's own |
| `accent` | a marked item, a Title | `cyan` |
| `muted` | a description | `bright-black` |
| `dim` | what stands back | `{ dim: true }` |
| `success` | a chosen box | `green` |
| `warning` | a warning | `yellow` |
| `error` | an error | `red` |
| `border` | the borders of a box | `{ dim: true }` |
| `borderAccent` | the frame of what waits on the person, such as a Request | `cyan` |
| `borderMuted` | a border that stands further back | `{ dim: true }` |
| `heading` | a markdown heading | `{ color: 'cyan', bold: true }` |
| `code` | markdown's inline code and code blocks | `yellow` |
| `link` | a markdown link's text | `{ color: 'blue', underline: true }` |
| `selection` | the Selection, over the cells it covers | `{ inverse: true }` |

The glyphs, and their defaults: `mark` `›`, `unmarked` a space, `checked` `[x]`, `unchecked` `[ ]`, `rule` `─`, `separator` ` | `, `divider` ` · `, `more` `…`. A box's `edge` is `rounded`, and its `padding` and `gap` are `0`. A node of a Layout that names its own keeps it.
