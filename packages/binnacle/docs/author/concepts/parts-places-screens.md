# Parts, Places and Screens

A Place is a leaf of a Layout, by its name. A Part fills a Place: it gives the lines that the Place draws.

```js
const placed = ctx.binnacle.place('status.state', {
  lines: (width) => [`${width} cells wide`],
})
```

- `binnacle.place(name, part)` fills the Place by that name, on every Screen. The newest Part in a Place wins. It returns a Handle.
- `lines(width)` gives the lines to draw at that width. A line keeps its colour and style. binnacle takes out every other control sequence, then wraps the line at the width.
- `models` are the Models that the Part is drawn from. binnacle draws the Part again after each of them changes.
- `cursor(width)`, while the Place has the Focus, says where the cursor is: `{ line, column }`.
- `key(data)` takes a key, as the terminal sent it, while the Place has the Focus. It returns `true` when it used the key.
- `click(at)` takes a click on the Part's lines. `at` is `{ line, column }` in its own lines. It returns `true` when it used the click.
- `focus(has)` says when the Place gets the Focus, or loses it.
- `follow` says how the Place follows the cursor. With `'end'`, the default, the Place with the Focus shows its end, and a cursor above the rows shown is brought to the top row. With `'least'`, the Place keeps the rows it showed, and moves them only as far as the cursor's row needs. It does this with the Focus or without it. The terminal's cursor is drawn only in the Place with the Focus. A List sets `'least'`, so it keeps its mark in view while the person types in another Place.
- The Handle has `redraw()`, `focus()`, which moves the Focus to the Part's Place, and `dispose()`, which takes the Part away.

A Screen is a Layout that fills the terminal. The Chat is the first Screen, by the name `chat`, and its Layout is `CHAT_LAYOUT`.

- `binnacle.show(screen)` shows a Screen: `{ name, layout, focus }`. Only the newest Screen shown is drawn. `focus` names the Place where the Focus starts. Dispose its Handle to show the Screen beneath it again.
- `binnacle.layout(name, layout)` replaces a Screen's Layout by its name, as [Layouts](layouts.md) says.

## Text

Text from a model, a tool or a stored session is Untrusted Text. Make it plain before it goes in a Part's lines, as binnacle keeps the colour and style of each line:

```js
import { toPlainText, truncateToWidth, visibleWidth } from '@easeshine/binnacle'

const lineOf = (untrusted, width) => truncateToWidth(toPlainText(untrusted), width, '…')
```

- `toPlainText(text)` takes every control sequence out of the text.
- `visibleWidth(text)` is the cells that the text takes in the terminal, with its colour and style not counted.
- `truncateToWidth(text, width, ellipsis)` cuts the text to that many cells, and ends it with `ellipsis` where it is cut, `...` if you give none.
- `wrap(text, width, { first, rest })` wraps the text at that many cells, with `first` before its first line and `rest` before each line after it. With no `rest`, the lines after the first start under the text. A style that spans a wrap is carried to the next line. An empty text gives `first` alone. A prefix wider than the width draws as wide as it is, and the text gets one cell a line. This wraps a prompt with a `> ` before each line:

  ```js
  import { toPlainText, wrap } from '@easeshine/binnacle'
  const lines = wrap(toPlainText(untrusted), width, { first: '> ', rest: '> ' })
  ```

- `markdown(binnacle, text, width)` gives the lines of a markdown text, wrapped at that many cells. It makes the text plain itself, so give it the text as it came. The transcript's view draws each answer with it. It draws headings, bold, italic, inline code, code blocks, lists, quotes, links and rules. Any other token, such as a table, raw HTML, a strikethrough or an image, draws as its source text. An empty text gives no line. Blocks are joined by one blank line, and the items of a list by none.
- Each block draws through a Look of its own, given what it draws, already drawn, and `{ width }`, and returns lines. Its types are from `binnacle`:

  | Look | Draws | Given | Default | Type |
  |---|---|---|---|---|
  | `markdown.heading` | a heading | its inline text, and `{ depth }` | the text in the `heading` Tone, with no `#` | `MarkdownHeadingLook` |
  | `markdown.paragraph` | a paragraph, and a token drawn as its source | its inline text | wrapped at the width | `MarkdownParagraphLook` |
  | `markdown.code` | a code block | its lines, made plain, and `{ lang }`, `''` with none | each line indented two cells in the `code` Tone, wrapped under its indent | `MarkdownCodeLook` |
  | `markdown.item` | a list item | its blocks' lines, drawn at the width less its marker, and `{ marker, ordered, number }` | the marker, `• ` or `<number>. `, before the first line, and the other lines under the text | `MarkdownItemLook` |
  | `markdown.quote` | a quote | its blocks' lines, drawn at the width less two | each line after `│ `, in the `muted` Tone | `MarkdownQuoteLook` |
  | `markdown.rule` | a rule | `{ width }` alone | the `rule` glyph across the width, in the `border` Tone | `MarkdownRuleLook` |

  Inline, bold and italic draw as the terminal's bold and italic, code in the `code` Tone, and a link as its text in the `link` Tone, then ` (<destination>)` when the destination is not its text. An item's `number` counts from its list's start, and from 1 in a list that is not ordered. A nested list is a block of its item, so it draws under the item's text. A task's box draws as its source, such as `[x] `, at the start of the text, and counts toward its wrap. This draws each code block in a frame with its language in the top edge:

  ```js
  import { markdown } from '@easeshine/binnacle'
  ctx.binnacle.look('markdown.code', () => (lines, { lang, width }) => [
    `┌─ ${lang} ${'─'.repeat(Math.max(0, width - lang.length - 4))}`,
    ...lines.map((line) => ctx.binnacle.paint('code', `│ ${line}`)),
    `└${'─'.repeat(Math.max(0, width - 1))}`,
  ])
  const lines = markdown(ctx.binnacle, untrusted, width)
  ```

- `frame(binnacle, lines, width, { title, tone })` gives the lines in a box, `width` wide, drawn with the theme's `edge`. Each line is wrapped inside the box. The edge draws in the `border` Tone, or in `tone` when you give one. `title` draws in the top edge, cut with the `more` glyph where it does not fit. A frame narrower than 4 cells gives the lines wrapped at the width, with no box. A line keeps its colour and style, so make Untrusted Text plain first. A line is a string, or an object with its `text`, such as a transcript's `Line`: each row it wraps to keeps its other fields, so a line marked `fold` or `run` still acts in a frame. Its `from` moves past the left edge on its first row, and each row after it acts from its first cell inside the edge. Its options' type is `FrameOptions`, and a line's `Framed`. This draws an error in a box of the `error` Tone:

  ```js
  import { frame, toPlainText } from '@easeshine/binnacle'
  const lines = frame(ctx.binnacle, [toPlainText(untrusted)], width, { title: 'Failed', tone: 'error' })
  ```

- `rule(binnacle, text, width)` gives a Title's rule: the `rule` glyph across the width, with the text in it, in the `accent` Tone, such as `── Fruit ─────`. An empty text gives the rule alone. The default Look of a [Title](../components/title.md) draws it.

## The Chat's session

The core opens the session that the Chat shows, and provides it as `ctx.binnacleSession`: its `id`, its `agent`, its `events`, `send(text)` and `interrupt()`. It opens after dsh's plugins start. So wait for it in `apply`, as the status line does:

```js
export function apply(ctx) {
  ctx.inject(['binnacleSession'], (ctx) => {
    ctx.binnacle.place('status.model', { lines: () => [ctx.binnacleSession.id] })
  })
}
```
