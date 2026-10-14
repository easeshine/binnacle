# Layouts

A Layout is a tree. Its leaves are Places, which Parts fill, by name.

| Node | Draws |
|---|---|
| `{ place: 'composer.input' }` | the Part placed in that Place |
| `{ row: [...] }`, `{ column: [...] }` | its children side by side, or one above the other |
| `{ row: [...], separator: true }` | one line: the first line of each child, joined by the `divider` glyph |
| `{ layout: 'request' }` | the Layout set by that name |
| `{ first: [...] }` | only its first child that has a line to draw |
| `{ over, float, at }` | `over`, with `float` on top of it while `float` has a line to draw |

Every node can also take:

- `size`: `'fill'`, a share of what is left (in a column, a node that fills takes no more than its lines need while another that fills needs more, and what is left after is shared evenly); `'content'`, the cells its lines need; `{ fixed: n }`, in cells, its box included; or `{ most: n }`, the cells its lines need, up to `n`, its box included. A Place taller than a node of `{ most: n }` scrolls in it, as a Place does, so a List keeps its mark in view. A node with no size fills in a Screen's own Layout, and takes what its lines need in a Layout set by name.
- `unless: name`: it draws nothing, and takes no cells, while the Layout or the Place by that name has a line to draw.
- `mouse: false`: a click, a drag or the wheel inside it does nothing, and a click there moves no Focus. On the root of the Screen's Layout, it gives the mouse back to the terminal: binnacle asks for no mouse reports while no Place on view takes the mouse, so a drag selects as the terminal does ([Copying](../built-ins/copy.md)).
- `clicks: false`: a click inside it does nothing, and moves no Focus. The wheel still scrolls there, and a drag still selects. This turns off clicks in a Request, and keeps the wheel on its body: `binnacle.edit('chat', { replace: 'request', with: { layout: 'request', size: 'content', clicks: false } })`.
- `clickFocus: false`: a click inside it reaches its Part and its Place's actions, and moves no Focus, as for a Place that a person reads. A Place that has the Focus keeps it, and shift+tab still moves the Focus there. The Chat sets it on the transcript, so a click there leaves the keys in the composer. `binnacle.edit('chat', { replace: 'transcript', with: { place: 'transcript', size: 'fill' } })` gives the transcript its click Focus back.
- A box: `padding` and `gap` in cells, a `border` on every side (`true`) or on the sides it names, the `edge` its border is drawn with, and a `title` set in its top edge.

A `{ layout: name }` node or a `first` that has no line to draw takes no cells, its box included. A node has a line to draw while a Place in it does.

A row with `separator: true` draws one line, as the status line does. Each child is drawn at the row's whole width, and gives its first line: a Part's first line, before it wraps, or a node's first drawn row. Its lines past the first are not drawn. A child that draws nothing, or an empty line, takes no divider. The joined line is cut at its end with the `more` glyph, and draws empty where `more` does not fit. A child's `size` and box are not drawn, and `gap` does nothing. A click lands on the child under it.

A float is the only node that draws over what it covers. A click and the wheel land on it first. `at.side` is `'top'`, `'center'` or `'bottom'`, and `at.width` is its width in cells. With no `at`, it is centred, and 4 cells narrower than what it covers, at most 80. Its height is what its lines need.

`binnacle.layout(name, layout)` sets the Layout by that name, and the newest wins. A Screen's Layout has the Screen's name, so `binnacle.layout('chat', …)` replaces the Chat's. The Chat's own Layout is exported as `CHAT_LAYOUT`:

```js
{
  column: [
    { place: 'transcript', size: 'fill' },
    { layout: 'status', size: 'content' },
    { layout: 'request', size: 'content' },
    { layout: 'composer', size: 'content', unless: 'request' },
  ],
}
```

The Layout `status` is the status line, as [The status line](../built-ins/status-line.md) says, and the Layout `composer` is the composer, as [The composer](../built-ins/composer.md) says. A Request that stands is drawn by the Layout `request` in the composer's stead, as [Requests](../built-ins/requests.md) says.

Build on it to move one node, such as the composer to the top:

```js
import { CHAT_LAYOUT } from '@easeshine/binnacle'

const composer = CHAT_LAYOUT.column.filter((node) => node.layout === 'composer')
const others = CHAT_LAYOUT.column.filter((node) => node.layout !== 'composer')
ctx.binnacle.layout('chat', { ...CHAT_LAYOUT, column: [...composer, ...others] })
```

Or float a Layout of your own over the Chat, and hide the status line while it shows:

```js
ctx.binnacle.layout('chat', {
  over: { column: CHAT_LAYOUT.column.map((node) => (node.layout === 'status' ? { ...node, unless: 'menu' } : node)) },
  float: { layout: 'menu', border: true },
  at: { side: 'bottom', width: 40 },
})
ctx.binnacle.layout('menu', { column: [{ place: 'menu.title' }, { place: 'menu.items' }] })
```

`CHAT_LAYOUT` is frozen: make a new node, as above, rather than change one in place.

## Edit one node

`binnacle.edit(name, edit)` changes one node of the Layout or Screen by that name, and keeps the rest. Two plugins that edit one Layout both apply, where two Layouts set by one name replace each other. An edit names its node by an anchor: the name in a node's `place` or `layout`.

| Edit | Does |
|---|---|
| `{ insert: node, after: 'x' }`, `{ insert: node, before: 'x' }` | adds `node` beside the anchor's node |
| `{ move: 'y', after: 'x' }`, `{ move: 'y', before: 'x' }` | takes the node of `y`, as it stands with its box, out of its place, and puts it beside the node of `x` |
| `{ move: 'y', over: 'x', at }` | takes the node of `y` out of its place, and floats it over the node of `x`, where `at` says, as a float node does |
| `{ remove: 'x' }` | takes the anchor's node out |
| `{ replace: 'x', with: node }` | puts `node` in the anchor's node's place |

So one edit moves the composer above the transcript, and its `size` and `unless: 'request'` come with it:

```js
ctx.binnacle.edit('chat', { move: 'composer', before: 'transcript' })
```

And one edit draws the offer of commands as a dialog over the transcript, and leaves nothing before the composer:

```js
ctx.binnacle.edit('chat', { move: 'commands', over: 'transcript', at: { side: 'center' } })
```

- An edit applies each time the Layout is drawn, to the newest Layout by that name, whoever set it. While its anchor is not there, it does nothing, and it applies again when the anchor comes back.
- It looks for its anchor through rows, columns, `first`, `over` and `float`, children in order and `over` before `float`, and takes the first node it finds. It does not look inside a named Layout that the Layout draws: edit that one by its own name.
- An insert, or a move beside a node, needs a row, a column or a `first` around its anchor. Beside the root, `over` or `float`, it does nothing. A removed root draws nothing.
- A move `over` a node needs no row around it. It puts a float node in the node's place, with the node's `size` and `unless`, so the floated node goes when that node is hidden. Two moves over one node float each over the one before. The float goes with the node when another move moves it, and goes when a remove takes the node out.
- A move finds both its anchors as an insert does. While either is not there, it does nothing. What an insert put beside the moved node stays in the old place.
- Inserts apply first, then moves, then replaces, then removes. A replace or a remove acts on its anchor's node in the Layout as set, where a move put it, so it never acts on a node that an insert added. An insert beside a node that another plugin removes stays, and a remove after a replace takes out what the replace put there. An insert can find its anchor in a node that another insert added.
- Within each kind, a built-in's edits apply before yours, then the edits go by the `name` of the plugin that made each, a plugin with no name first. Of two replaces of one node, the one applied last holds. So the order never depends on which plugin loads first.
- Several inserts after one anchor go in that order: the first is next to it. Before it, the last is next to it.
