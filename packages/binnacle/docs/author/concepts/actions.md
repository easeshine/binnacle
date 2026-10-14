# Actions

An action is something a person does with a key, or with a click in its Place. It has an id. A component's actions are named `<instance>.<verb>`, and their kind `<component>.<verb>`.

```js
ctx.binnacle.action('fruit.toggle', {
  kind: 'list.toggle',
  place: 'fruit',
  description: 'Check the marked fruit',
  run: () => fruit.set((state) => (state.checked = !state.checked)),
})
```

- `binnacle.action(id, action)` sets an action. `run(at, beneath)` does it. At a click, `at` is the cell clicked, as a line of the Part's lines and a column. At a key, it is `undefined`. The action goes when the plugin that set it unloads.
- `keys` are the gestures it is bound to until someone binds it: keys by name, such as `enter`, `space`, `tab` or `ctrl+n`, and `click`.
- `place` is the Place, or the Places, where it takes a gesture: while the Place has the Focus, or for a click, while the click is in it. With no `place`, it takes a key wherever the Focus is. A Place that an action acts in takes the Focus, as a Part that takes keys does.
- `first: true` makes an action of a Place take its key before the Part with the Focus, such as tab while a line is being typed. An action with no `place` is never before the Part.
- While `enabled()` returns false, the action is as if it were not set. The gesture goes on to the action beneath it by its id, then to the next taker.
- `kind` is a name that every action of its kind shares, so that one binding binds them all.

A key goes, in this order, to:

1. The actions marked `first` of the Place with the Focus.
2. The Part with the Focus.
3. The other actions of the Place with the Focus.
4. The actions with no Place. binnacle's own gestures are here, such as ctrl+c and escape, beneath each action that an author sets.

A click goes to the Part under it, then to its Place's actions bound to `click`. It acts on the release, on the cell where it was pressed, and a press that moves selects instead ([Copying](../built-ins/copy.md)). The wheel goes to the actions with no Place, and so does `select`, which a release fires when it ends with a Selection. In one step, the newest enabled action by an id takes the gesture, and of two ids, the action set last wins.

`binnacle.gestures.actionsOf(gesture)` gives the ids of the actions that a gesture is bound to now. It takes a key, as the terminal sent it. It gives the editor's keys of the Gesture Table, and each enabled action, binnacle's own or a plugin's, that acts wherever the Focus is or in the Place with the Focus. A Part that takes keys can pass on each key that another action is bound to, as the composer does. Read it also to keep a key of your own off a key that binnacle uses.

## Bind an action

```js
ctx.binnacle.bind('list.toggle', ['space'])
ctx.binnacle.bind('request.choices.down', (keys) => [...keys, 'j'])
```

- `binnacle.bind(name, keys)` binds the action by that id, or every action of that kind. A binding by id is given, or replaces, what its kind's gives. A binding goes when the plugin that set it unloads.
- binnacle's own gestures are actions that you bind by id: `binnacle.clear` (ctrl+c), `binnacle.interrupt` (escape), `binnacle.suspend` (ctrl+z), `binnacle.focus.next` (shift+tab), `binnacle.scroll.up` and `binnacle.scroll.down` (the wheel). So `binnacle.bind('binnacle.interrupt', (keys) => [...keys, 'ctrl+x'])` makes ctrl+x interrupt the turn, from the composer too.
- A list of keys replaces the keys beneath it, and `[]` unbinds.
- A function adds to the keys beneath it, or takes some away: it is given the keys the action would have without it, and returns its keys. binnacle calls it each time a key or a click is resolved, so it holds whichever plugin loads first, and for an action set after it. Two such bindings by one name both apply, the newest given what the one beneath it gives. Use it to add a key without repeating the others.
- `binnacle.keysOf(id)` is the keys that the newest action by that id is bound to now, enabled or not. Use it to show or to check a key, after the action is set: it is read when you call it, so it does not follow a binding or an action that comes later. It does not follow `enabled()` either: an action that names its own keys owns its id's keys, even while it is disabled.
- With no action by an id, `binnacle.keysOf(id)` gives what the bindings by that id give over the Gesture Table's keys for it. The Gesture Table holds the editor's keys, by pi-tui's names, such as `tui.select.up` (up), `tui.select.confirm` (enter), `tui.input.submit` (enter) and `tui.input.newLine` (shift+enter and ctrl+j). The transcript and the composer take their keys from it so: `keys: ctx.binnacle.keysOf('tui.select.up')`.

## Run an action, and change what it does

`binnacle.run(id)` runs the newest enabled action by that id, wherever the Focus is, as a call is not a gesture. With none enabled, nothing runs. `binnacle.run(id, at)` gives the action `at`, a cell `{ line, column }` in the lines of its Part, as a click gives the cell clicked. So an action that a click runs can hand its cell to the action that owns what the click does.

To give an action another gesture, set an action of your own that runs it by its id. Here ctrl+d pages down the List `fruit` of [List](../components/list.md). It does this only while the List has more than ten items:

```js
ctx.binnacle.action('fruit.downMore', {
  keys: ['ctrl+d'],
  place: 'fruit',
  enabled: () => fruit.state.items.length > 10,
  run: () => ctx.binnacle.run('fruit.pageDown'),
})
```

An action set with the id of another hides it, and is handed it as `beneath`. Run `beneath()` to keep what the action did, and add to it. So two plugins that each change one action both act, the newest first:

```js
ctx.binnacle.action('requests.send', {
  enabled: () => preview.state.on,
  run: (at, beneath) => {
    preview.set((state) => (state.shown = true))
    beneath()
  },
})
```

- An action with no `keys`, or no `kind`, keeps those of the action it hides. An action with no `place` keeps the `place` and the `first` of the action it hides. So it takes a gesture only where that action did. An action that names its own `place` acts there. To act from every Place, set an action of a new id.
- An action with no `enabled` is enabled while the action it hides is: the newest beneath it that names `enabled`. With none, it is enabled always. To be enabled always over a gated action, name `enabled: () => true`.
- An action with no `run` runs `beneath()`. Set one with only `keys`, `place` or `enabled` to change where or when the action acts, and keep what it does.

This changes what enter does in the offer of commands, and keeps when it does it: enter sends the draft as it is typed, but only while the offer draws, as the List's own pick did:

```js
ctx.binnacle.action('commands.list.pick', { run: () => ctx.binnacle.run('composer.send') })
```

A `place` can be a function. It is given the Places the action would keep with no `place` of its own, as a list, `[]` where the action it hides has none, and returns the action's Places. The action keeps the `first` of the action it hides. binnacle reads it at each gesture, so it adds a Place to an action whichever plugin loads first. This moves the offer's mark with up from a search line of your own, `commands.search`, too:

```js
ctx.binnacle.action('commands.list.up', { place: (places) => [...places, 'commands.search'] })
```
- `beneath()` is found each time it runs: the newest enabled action by that id beneath this one, wherever the Focus is, or nothing. When the plugin of an action between them unloads, the next `beneath()` uses the actions as they stand.
