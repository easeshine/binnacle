# The theme

The theme is the tokens that everything binnacle draws is drawn with: a colour for each Tone, the glyphs, and a box's edge, padding and gap. An author changes a token once, and everything drawn with it changes.

```js
ctx.binnacle.theme({
  colors: { accent: 'magenta', border: { color: '#5f87af', bold: true } },
  glyphs: { mark: '>' },
})
```

- `binnacle.theme(layer)` adds a layer. Only the tokens that it names change, and the others stay as they were. The newest layer wins for each token, and the person's own colours win over every layer ([The person's own colours](#the-persons-own-colours)). A layer goes when the plugin that added it unloads, and everything is drawn again.
- A colour is a Hue by name, such as `cyan` or `orange`; a 256-colour index, such as `67`; or an exact colour, as `#rrggbb`, `#rgb`, `okhsl(h s% l%)` or `oklch(l c h)`. An exact colour is drawn as the nearest of 256 where the terminal has no truecolor.
- A Tone's token is a colour, or a Style: `{ color, background, bold, dim, italic, underline, inverse, like }`. `inverse` swaps the text's colour and the background's. A plain colour stands for `{ color }`, and a Style with no `color` keeps the terminal's own.
- `binnacle.theme` refuses a colour that is not one, such as `'36'`, be it a Tone's colour or its background, and names its Tone.
- `binnacle.tokens` is the tokens as the layers make them now. `binnacle.paint(tone, text)` draws text in a Tone, and `binnacle.paint(style, text)` in a Style of your own, such as `{ bold: true }`, so you need no escape code. A Style's colour or background that is not one makes `paint` throw. A Tone follows the theme, and a Style does not, but for its `like` and its Hues. A Tone or a style painted inside it ends, and the text after it draws in the outer Tone again. Paint in a Part's `lines`, so that the lines follow the theme when it changes:

```js
ctx.binnacle.place('status.state', {
  lines: () => [ctx.binnacle.paint('accent', `${ctx.binnacle.tokens.glyphs.mark} ready`)],
})
```

- `binnacle.fill(given, text)` draws as `paint` does, and leaves the background open at the line's end, so the line fills the rest of its Place's row to the edge, on each row that it wraps to. Fill with a Style, `binnacle.fill({ background: 'blue' }, 'text')`, or with a Tone that a layer of yours gives a background: no Tone has one by default. A fill reaches the content of what holds it: a box's padding and edges draw as they did, a float over a filled row leaves the fill on each side of it and stops it at the same edge, a `frame`'s inner edge is where it stops, and a separated row's line fills only as far as its text. `fill(given, '')` opens the background with no text, so an empty line fills its row, and a person who copies a filled row gets its text with no spaces at its end. A background painted with `paint` stops where its text stops, and so does a colour, bold, dim, italic, underline or inverse left open at a line's end: only a fill goes past a line's text. Fill the lines of a card behind their text:

```js
ctx.binnacle.theme({ colors: { muted: { background: 'bright-black' } } })
ctx.binnacle.place('card', {
  lines: () => [
    ctx.binnacle.fill('muted', ''),
    ctx.binnacle.fill('muted', ctx.binnacle.paint('accent', 'A card')),
  ],
})
```

## The person's own colours

A person writes their own colours in `palette.json`, in binnacle's profile folder ([Colours](../../use/colours.md)). The file holds a layer's `hues` and `colors`, and binnacle reads it again at each save. Its layer lies over every plugin's layer, a built-in's or an author's, whichever loads last. No plugin can rank above it, so no feature draws over the person's choice. `binnacle.tokens`, `paint` and `fill` draw with it.

- A Tone of a feature's own that the file does not name keeps its `like`, so it follows the person's colour of the general Tone.
- A file with a mistake leaves the colours as they were. `binnacle.palette` is a Model of `{ inUse, shown, error }`: `error` says what is wrong, as `palette.json: ` and why, and is `undefined` while nothing is. The status line draws it in `status.palette`.
- `inUse` is the id of the palette that the file's `palette` names, or `terminal`, binnacle's defaults, while it names none. `shown` is the id of the palette drawn now.
- Watch `binnacle.palette`, or name it in a Part's `models`, to draw again when it changes. Its `set` changes nothing: only the file does.

```js
ctx.binnacle.place('warning', {
  models: [ctx.binnacle.palette],
  lines: () => (ctx.binnacle.palette.state.error === undefined ? [] : [ctx.binnacle.paint('warning', 'see palette.json')]),
})
```

## Hues

A Hue is one named colour of the palette: the terminal's sixteen, `black` to `bright-white`, and `orange`. A Tone in a Hue, such as `{ color: 'cyan' }`, draws in the Hue's colour, and a layer's `hues` change the colour of each Tone in it at once. A Tone in an exact colour stays as it is.

```js
ctx.binnacle.theme({ hues: { cyan: '#5fd7ff', orange: '#ffaf00' } })
```

- A Hue's colour is a 256-colour index or an exact colour. One of the sixteen as its own Hue's colour, such as `{ cyan: 'cyan' }`, is the terminal's own, the default of each of the sixteen. A Hue cannot be another Hue.
- `orange` is the colour 208 of 256 by default, as the sixteen have no orange.
- A background in a Hue follows the Hue, as a colour does.
- `binnacle.theme` refuses a Hue that is not one, such as `purple`, and a Hue's colour that is not one, and names the Hue.
- `binnacle.tokens.hues` is the colour of each Hue now.

## `like`

A Style's `like` names a Tone. The Style draws as that Tone, with its own colour, background and attributes over it, and follows each later change to that Tone:

```js
ctx.binnacle.theme({ colors: { 'mine.error': { like: 'error', bold: true } } })
ctx.binnacle.paint({ like: 'warning', italic: true }, 'text')
```

- A layer that gives the Tone its own Style replaces its `like`, as a layer replaces any token.
- A `like` of a Tone that no layer gives adds nothing: the Tone draws with its own Style alone.
- `binnacle.theme` refuses a layer whose `like` makes a loop, such as `a` like `b` and `b` like `a`, and names the Tones of the loop. A loop can come back when the layer that broke it goes: then each Tone of the loop draws with its own Style alone, and nothing throws.
- `binnacle.tokens.colors` gives each Tone's Style as it draws, its `like` read.

## A feature's own Tones

A Tone's name is open: a Tone of a new meaning, such as `diffMoved`, draws once a layer gives it, and a Tone that no layer gives draws plain. A feature gives its own colours as Tones of its own, named as its Looks are, `<the feature's Look name>.<the general Tone>`, such as `transcript.card.error`. Its own layer makes each one look like the general Tone, so a person's change to the general Tone reaches it, and a person changes it alone:

```js
ctx.binnacle.theme({ colors: { 'mine.error': { like: 'error' } } })
ctx.binnacle.place('mine', { lines: () => [ctx.binnacle.paint('mine.error', 'failed')] })
```

## The Tones

The Tones are pi's names, so that a palette made for pi has a place for each of its colours. Four of binnacle's Tones were renamed to pi's names: `heading` is now `mdHeading`, `code` is `mdCode`, `link` is `mdLink`, and `selection` is `selectedBg`. A layer, `paint`, `fill` and a `like` that name an old name throw an error that names the new name.

No Tone has a background by default. A Tone of pi's that is a background, `…Bg`, is empty, but `selectedBg`, so nothing is drawn behind the text. A Tone that nothing in binnacle draws yet, such as `syntaxKeyword`, is in the list, so a feature that draws it finds it.

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
| `mdHeading` | a markdown heading | `{ color: 'cyan', bold: true }` |
| `mdCode` | markdown's inline code and code blocks | `yellow` |
| `mdLink` | a markdown link's text | `{ color: 'blue', underline: true }` |
| `selectedBg` | the Selection, over the cells it covers | `{ inverse: true }` |
| `searchMatchBg` | a search's match | `{ like: 'selectedBg' }` |
| `searchMatchText`, `scrollbarThumb`, `toolTitle`, `toolOutput`, `mdLinkUrl`, `mdListBullet` | a search match's text, a scrollbar's thumb, a tool's title and output, a link's address, a list's bullet | `{ like: 'text' }` |
| `scrollbarTrack`, `customMessageText`, `mdQuote`, `mdCodeBlockBorder`, `toolDiffContext`, `syntaxComment`, `syntaxOperator`, `syntaxPunctuation` | a scrollbar's track, a custom message, a quote, a code block's border, a diff's context, and code's comments, operators and punctuation | `{ like: 'muted' }` |
| `mdQuoteBorder` | a quote's bar | `{ like: 'mdQuote' }` |
| `mdCodeBlock` | a code block | `{ like: 'mdCode' }` |
| `mdHr` | a markdown rule | `{ like: 'border' }` |
| `thinkingText` | reasoning | `{ like: 'dim' }` |
| `userMessageText` | a prompt | `{ like: 'accent' }` |
| `toolDiffAdded`, `toolDiffRemoved` | a line added, a line removed | `{ like: 'success' }`, `{ like: 'error' }` |
| `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg` | the background of a prompt, a custom message, and a tool that runs, succeeded or failed | `{}` |
| `customMessageLabel`, `syntaxType` | a custom message's label, a type in code | `magenta` |
| `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber` | a keyword, a function, a variable, a string and a number in code | `blue`, `yellow`, `cyan`, `orange`, `green` |
| `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh`, `thinkingMax` | each thinking level | `bright-black`, `blue`, `bright-blue`, `magenta`, `bright-magenta`, `red`, `orange` |
| `bashMode` | the composer in bash mode | `green` |

## The glyphs and the spacing

The glyphs, and their defaults: `mark` `›`, `unmarked` a space, `checked` `[x]`, `unchecked` `[ ]`, `rule` `─`, `separator` ` | `, `divider` ` · `, `more` `…`. A box's `edge` is `rounded`, and its `padding` and `gap` are `0`. A node of a Layout that names its own keeps it.
