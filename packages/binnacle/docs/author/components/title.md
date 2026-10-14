# Title

A rule across the width, with its text in it: `── Fruit ─────`.

```js
import { title } from '@easeshine/binnacle'

title(ctx.binnacle, { name: 'fruit.title', text: () => 'Fruit' })
```

- `text()` gives the text, which the Title makes plain. While it gives `undefined`, the Title draws nothing. `''` draws the rule alone.
- `models` are what the text is drawn from, so that the Title is drawn again when it changes.
- The Look `title.row`, or `<name>.row`, draws it: `(text, { width }) => line`. Its default is `rule(binnacle, text, width)`, which draws the `rule` glyph and the text in `accent`.
