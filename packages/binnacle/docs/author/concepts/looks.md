# Looks

A Look is how one piece of a component is drawn, such as a List's row. An author sets a Look by the component's kind, for every instance of it, or by an instance's name, for that instance alone. A component's pieces are named `<instance>.<piece>` and `<component>.<piece>`.

```js
ctx.binnacle.look('list.row', (beneath) => (item, at) => beneath(item, at).toUpperCase())
ctx.binnacle.look('request.choices.row', (beneath) => (item, at) => ctx.binnacle.paint({ bold: true }, beneath(item, at)))
```

- `binnacle.look(name, make)` sets a Look. `make` is handed `beneath`, the Look that the new one hides, and returns the new Look, which takes what the component's piece takes. Draw `beneath` to keep what is beneath and add to it, or leave it out to draw the piece your own way.
- `binnacle.look(name, make, { models })` names the models that the Look reads, such as a Model or `ctx.binnacleRequests`. When one of them changes, everything drawn with Looks is drawn again, so the Look follows it. A Look that names none is drawn again when the Part that draws it is.
- The newest Look by a name wins. An instance's Looks lie on its kind's Looks, and those on the component's default. So `request.choices.row` above draws in bold what `list.row` draws, and `list.row` draws the default in capitals.
- `beneath` is found each time it draws. When the plugin of a Look between them unloads, or a Look loads beneath later, the next draw uses the chain as it stands. A Look goes when the plugin that set it unloads, and everything is drawn again.
- `indented(look, cells)` is a Look that draws `look` at its width less `cells`, with that many spaces before each line. It is for a Look that takes `(data, { width, … })` and returns lines, such as the transcript's. A line object keeps its fields, and its `from` moves past the spaces, so a line that folds still folds. This indents each tool call and each result by two cells:

```js
import { indented } from '@easeshine/binnacle'
ctx.binnacle.look('transcript.call', (beneath) => indented(beneath, 2))
ctx.binnacle.look('transcript.result', (beneath) => indented(beneath, 2))
```

- `binnacle.lookOf(names, fallback)` gives the Look that draws a piece, for a component of your own: the newest Look by the first name, then by the next, down to `fallback`, the component's default. Call it in a Part's `lines`, so that the lines follow the Looks when they change:

```js
const row = (label) => `- ${label}`
ctx.binnacle.place('fruit', {
  lines: () => ['fig', 'oak'].map((label) => ctx.binnacle.lookOf(['fruit.row', 'tags.row'], row)(label)),
})
```
