# Commands

The row `binnacle-commands` offers dsh's commands while a person types one. A draft that is `/` and a name opens the offer above the composer. The name can be empty. The offer shows the commands that match the name, each as `/<name>` with its description in `muted`.

Up and down move the mark while the person types. Enter runs a command that takes no input, or puts `/<name> ` in the draft for its input. Tab puts `/<name> ` in the draft. Esc closes the offer and keeps the draft.

The offer only offers: the composer runs a command line ([The composer](composer.md)). So with the row off, a command typed in full still runs.

The offer is the Layout `commands`. The row puts it in the Chat with this edit, so a Request that stands hides it with the composer:

```js
ctx.binnacle.edit('chat', { insert: { layout: 'commands', size: 'content', unless: 'request' }, before: 'composer' })
```

The Layout is `COMMANDS_LAYOUT`, from `@easeshine/binnacle/plugins/commands`, frozen: the List `commands.list`, at most 9 cells with its rule, so 8 rows:

```js
{ place: 'commands.list', size: { most: 9 }, border: ['top'] }
```

- The model `commands`, of the type `CommandsState`, holds `open`, whether the offer is open, and `query`, the name typed after the `/`. Its `items` are the commands whose names match `query` with `fuzzy`, read from dsh at each read, each `{ label, description, name, hint }` of the type `CommandItem`. `label` is `/<name>`, and `hint` is the command's input hint, or `undefined` when it takes no input. The row sets the model: read it, and change it through the actions.

  ```js
  const offer = ctx.binnacle.modelOf('commands')
  offer.state.items.map((item) => item.name)
  ```

- The row opens the offer when the draft becomes `/` and a name, with nothing after it. It sets `query` to the name as the person types. It closes the offer when the draft stops being one. It acts only when the draft changes. So an offer closed with esc stays closed until the person types, and an offer that you open stays open until it is closed. While a command runs, the row closes the offer, and does not open it.
- The offer opens, closes, picks and completes through five actions. Set one to change what it does, or to take it out:
  - `commands.open`: the row runs it. It sets `open`, and a `query` of `''`.
  - `commands.dismiss`: esc, in `composer.input`, before the draft, while the offer draws a line. It runs `commands.close`. Only a person's esc runs it, so set it to act at esc alone.
  - `commands.close`: no keys. The row runs it when the draft stops being `/` and a name, and each other action runs it to close the offer. It clears `open`.
  - `commands.pick`: enter, and a click on a command, through the List. It takes the marked command. With a `hint`, it sets the draft to `/<name> `. With none, it sets the draft to `/<name>`, and runs `composer.send`. Then it runs `commands.close`.
  - `commands.complete`: tab, as esc. It sets the draft to `/<name> ` for the marked command, then runs `commands.close`.

  This one takes the offer out, and a command typed in full still runs:

  ```js
  ctx.binnacle.action('commands.open', { run: () => {} })
  ```

  This one clears the draft when the person presses esc, and keeps it when the offer closes as the person types:

  ```js
  const composer = ctx.binnacle.modelOf('composer')
  ctx.binnacle.action('commands.dismiss', {
    run: (_at, beneath) => {
      beneath()
      composer.set((state) => (state.text = ''))
    },
  })
  ```

- The List `commands.list` takes its keys in `composer.input` with `keysIn`, so up, down, page up and page down move its mark while the person types. Its Model, `{ mark }`, and its actions, `commands.list.up` and the rest, are named apart from the model `commands` and its actions. Its mark goes back to the first command when `query` changes.
- A command is drawn by the List's pieces, `commands.list.mark`, `commands.list.label` and `commands.list.description`, of the type `ListPiece<CommandItem>`. Each is given the item with its `name` and `hint`. Draw a command's hint after its name, and the row stays the List's own:

  ```js
  ctx.binnacle.look('commands.list.label', (beneath) => (item, at) =>
    item.hint === undefined ? beneath(item, at) : beneath(item, at) + ctx.binnacle.paint('dim', ` ${item.hint}`),
  )
  ```

- The whole row is the Look `commands.list.row`, then `list.row`, of the type `CommandRow`. The row `binnacle-commands` sets it to cut the default row at the width with the `more` glyph, so a command draws in one line. A row Look of yours over it is given the cut row as its `beneath`, and is not cut.

- Move the offer with an edit of the Chat, such as above the transcript:

  ```js
  ctx.binnacle.edit('chat', { move: 'commands', before: 'transcript' })
  ```

  To float it over the transcript, set the Layout `commands` to draw nothing, and draw `COMMANDS_LAYOUT` under a name of your own:

  ```js
  import { COMMANDS_LAYOUT } from '@easeshine/binnacle/plugins/commands'
  ctx.binnacle.layout('commands', { column: [] })
  ctx.binnacle.layout('offer', { ...COMMANDS_LAYOUT, border: true })
  ctx.binnacle.edit('chat', {
    replace: 'transcript',
    with: { over: { place: 'transcript' }, float: { layout: 'offer' }, at: { side: 'center' } },
  })
  ```

- A command that a plugin registers with dsh's `ctx.commands.register` is offered and runs as dsh's own. Its handler can show a Screen of its own with `binnacle.show`, and the Handle's `dispose` goes back to the Chat.
- On a stored session, or before the session opens, nothing is offered: there is no agent to list the commands for.
