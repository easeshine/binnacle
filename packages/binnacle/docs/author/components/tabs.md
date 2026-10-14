# Tabs

Labels in a row, one of them current, that a person moves between: `› Fruit |   Trees`.

```js
import { createModel, tabs } from '@easeshine/binnacle'

const pages = createModel({ current: 0 })
tabs(ctx.binnacle, {
  name: 'pages',
  labels: () => ['Fruit', 'Trees'],
  current: () => pages.state.current,
  go: (index) => pages.set((state) => (state.current = index)),
  keysIn: ['answer'],
  models: [pages],
})
```

- `labels()` gives the labels, which the Tabs make plain. The Tabs draw while there is more than one.
- `current()` gives the index of the current tab. An index past the last draws the last as current.
- `go(index)` runs when the person goes to a tab: a click on it, or tab and shift+tab. `index` is always within the labels.
- Tab goes to the next tab, and shift+tab to the one before. Tab on the last goes to the first, and shift+tab on the first to the last. They move from the tab drawn as current.
- `keysIn` names the Places where tab and shift+tab move between the tabs, even while a Line there takes every key. With none, the Tabs' own Place. A click on the Tabs moves no Focus.
- When the tabs are wider than the row, the current one is drawn, then its neighbours while they fit, and the `more` glyph marks each end where the row is cut. A current tab wider than the row is cut with `more`. A click on a `more` or a separator does nothing.
- `models` are what the labels and the current tab are drawn from, so that the Tabs are drawn again when they change.
- The actions are `<name>.next` and `<name>.previous`, of the kinds `tabs.next` and `tabs.previous`, marked `first`.
- The Look `tabs.tab`, or `<name>.tab`, draws one tab: `(label, { current, index }) => text`. Its default draws the `mark` glyph and the label in `accent` for the current tab, and the `unmarked` glyph and the label for the others. The `separator` glyph goes between the tabs.
