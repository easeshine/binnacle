# Line

One line that a person types in: `› what they typed`.

```js
import { createModel, line } from '@easeshine/binnacle'

const asking = createModel({ shown: true, question: 0 })
const answer = line(ctx.binnacle, {
  name: 'answer',
  shown: () => asking.state.shown,
  key: () => asking.state.question,
  submit: (text) => send(text),
  escape: () => asking.set((state) => (state.shown = false)),
  models: [asking],
})
```

- `shown()` says whether the Line is drawn. While it is, the Line takes every key while its Place has the Focus. Move the Focus to it with `answer.handle.focus()`.
- `submit(text)` runs on enter, and `escape()` on escape. Neither clears the text.
- `change(text)`, if you give it, runs after each key of the person's that changes the text, a paste too, with the new text. It does not run when you set the Model. Use it to act as the person types, such as to filter a List by what they type.
- `key()`, if you give it, says which text the Line holds: each value keeps its own, as each question of a form keeps its answer.
- `models` are what `shown()` and `key()` read, so that the Line is drawn again when they change.
- `answer.model` is the Line's Model, also named `name`: `{ texts }`, a `Map` from each value of `key()` to its text. It is what the Line holds. Set the shown key's text to change the Line, with the cursor at its end, and delete it to clear the Line: `answer.model.set((state) => state.texts.delete(key))`. The text stays after a submit, an escape, or while the Line is hidden, until you clear it.
- The Look `line.row`, or `<name>.row`, draws it: `(typed, { width }) => line`, where `typed(width)` is the text with its cursor, drawn in that many cells and scrolled to show the cursor. Its default draws the `mark` glyph in `accent`, then the text. A Look that adds to the line gives `typed` the cells that are left, and the cursor follows where the text is drawn.
