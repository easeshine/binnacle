# List

Items that a person marks and picks.

```js
import { createModel, list } from '@easeshine/binnacle'

const fruit = createModel({ items: [{ label: 'fig' }, { label: 'pear', description: 'ripe' }] })
const picker = list(ctx.binnacle, {
  name: 'fruit',
  items: () => fruit.state.items,
  pick: (index) => eat(fruit.state.items[index]),
  models: [fruit],
})
```

- `items()` gives the items: a `label`, an optional `description`, and an optional `checked`. An item with `checked` draws a box, `[x]` or `[ ]`. The List makes each label and description plain.
- An item can hold fields of your own, such as a command's `hint`. The List gives the Look `<name>.row` each item as `items()` gave it. In TypeScript, `list<Fruit>(…)` takes items of your type `Fruit`, which extends `ListItem`, and `ListRow<Fruit>` is the type of its row Look, so `item.hint` type-checks there.
- `pick(index)` runs when the person picks an item: enter picks the marked item, and a click picks the item clicked.
- Up and down move the mark, and wrap. Page up and page down move it by a page, and stop at the first and the last item. A page is as many items as the Place shows at once, an item that wraps counted once, and at least one.
- `key()`, if you give it, says which items are shown. When what it returns changes, the mark goes back to the first item. When the items are fewer and `key()` is the same, the mark stays on the last item. With no items there is no mark, and enter and the page keys do nothing.
- `toggle(index)`, if you give it, runs for the marked item on the action `<name>.toggle`. It has no keys until someone binds it: `ctx.binnacle.bind('list.toggle', ['space'])`.
- `keysIn` names the Places where up, down, page up, page down and enter act on the List, before the Part that has the Focus there, while the List draws a line. So a List above a Line moves its mark while the person types in the Line, as Tabs' `keysIn` does. While the List draws no line, the keys go to the Part. With no `keysIn`, the keys act in the List's own Place. A click and `toggle` always act in the List's own Place.
- `models` are what the items are drawn from, so that the List is drawn again when they change.
- `fuzzy(query, items, text)` gives the items whose `text(item)` holds the letters of `query` in order, whatever their case: the items whose text starts with the query first, then the items whose letters are closest together, then in their order. An empty query gives every item. This filters a List by `query()`, what the person types in the Line `search`:

  ```js
  import { fuzzy, list } from '@easeshine/binnacle'
  const shown = () => fuzzy(query(), fruit.state.items, (item) => item.label)
  list(ctx.binnacle, {
    name: 'fruit',
    items: shown,
    key: query,
    keysIn: 'search',
    pick: (index) => eat(shown()[index]),
    models: [fruit],
  })
  ```

- `picker.model` is the List's Model, also named `name`: `{ mark }`, the index of the marked item.
- The actions are `<name>.up`, `<name>.down`, `<name>.pageUp`, `<name>.pageDown`, `<name>.pick`, `<name>.click` and `<name>.toggle`, of the kinds `list.up` and the rest.
- The Look `list.row`, or `<name>.row`, draws one item: `(item, { marked, index, width }) => line`. Its default draws the mark, a space, the box, the label and the description. A row wider than the List wraps. A row Look of your own draws instead of all of it, and its `beneath` is the default row.
- The default row draws three pieces, each a Look of the type `ListPiece<T>`, `(item, { marked, index, width }) => text`. Change one piece, and the row stays the List's own:

  | Look | Default |
  |---|---|
  | `<name>.mark`, then `list.mark` | the `mark` glyph in `accent` when marked, and the `unmarked` glyph when not |
  | `<name>.label`, then `list.label` | the label as plain text, in `accent` when marked |
  | `<name>.description`, then `list.description` | ` — ` and the description as plain text, in `muted`, or `''` with none |

- The box draws a box's frame in `border`, and what a checked box holds in `success`. A box glyph that is not framed in brackets draws whole, in `success` when checked and in `border` when not.
