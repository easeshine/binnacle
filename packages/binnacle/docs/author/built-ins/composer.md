# The composer

The row `binnacle-composer` sets the Layout `composer`, which the Chat draws while no Request stands. It is a row with the Place `composer.input`, where the editor draws the draft, and where the Chat's Focus starts. Its rules are its box, drawn in the `border` Tone:

```js
{ row: [{ place: 'composer.input', size: 'fill' }], border: ['top', 'bottom'] }
```

- The draft is the model `composer`, of the type `ComposerState` from `@easeshine/binnacle/plugins/composer`. Its state's `text` is the draft as it would be sent: a large paste's content in full, not its marker. Typing and pasting change it. Set `text` to another draft, and it replaces the one shown, drawn in full with the cursor at its end. Set it to the draft it holds, and nothing changes. Its `running` is `true` while a command line that was sent runs. binnacle sets it: read it, and do not set it.

  ```js
  const draft = ctx.binnacle.modelOf('composer')
  draft.set((state) => (state.text = ''))
  ```

- Run `composer.send` right after you set `text`, and the draft that you set is sent.
- Enter runs the action `composer.send`, and shift+enter runs `composer.newline`. Both act in `composer.input`. Bind them as any action, so ctrl+s sends and enter makes a new line:

  ```js
  ctx.binnacle.bind('composer.send', ['ctrl+s'])
  ctx.binnacle.bind('composer.newline', ['enter'])
  ```

  A sequence that a terminal sends for shift+enter, and that names no key, runs `composer.newline` whatever its keys. Where one key is bound to both, such as ctrl+j, whose sequence is also enter's, it runs `composer.newline`.
- The default `composer.send` sends the draft as a prompt, or steers the turn that runs, adds it to the history, and clears it. With a backslash before the cursor, it takes the backslash out and runs `composer.newline` in its place. A draft of whitespace sends nothing, and on a stored session, or before the session opens, the draft stays.
- On a draft that starts with `/` and a letter, the default `composer.send` runs the line as a command, through dsh's service `commands`, and the model never sees it. It waits for the command, and while it waits, the draft's `running` is `true`, and `composer.send` does nothing. A command that fails keeps the draft. One that succeeds goes into the history, and clears the draft, unless the person edited the draft while it ran. A line whose name is no command, such as a skill's `/name`, is sent as a prompt. A command that a plugin registers with dsh's `ctx.commands.register` runs so too.
- Set `composer.send` to change what it does: run `beneath()` to keep the default, or leave it out to send nothing, as this one queues each draft while the agent runs:

  ```js
  const queue = []
  ctx.binnacle.action('composer.send', {
    run: (at, beneath) => {
      if (ctx.get('binnacleSession')?.agent?.status !== 'running') return beneath()
      queue.push(draft.state.text)
      draft.set((state) => (state.text = ''))
    },
  })
  ```

- Ctrl+c is `binnacle.clear`. The composer sets an action by that id in `composer.input`, enabled while the draft has text, so ctrl+c clears a draft, and goes on to binnacle's own on an empty one, which quits when it is pressed twice.
- Add a Place beside the draft with an edit of the Layout `composer`:

  ```js
  ctx.binnacle.edit('composer', { insert: { place: 'prompt', size: { fixed: 2 } }, before: 'composer.input' })
  ```

- `COMPOSER_LAYOUT`, the Layout above, frozen, is exported from `@easeshine/binnacle/plugins/composer`. Build on it to set the Layout `composer` again, such as with no rules:

  ```js
  import { COMPOSER_LAYOUT } from '@easeshine/binnacle/plugins/composer'
  ctx.binnacle.layout('composer', { ...COMPOSER_LAYOUT, border: false })
  ```

- An empty draft draws its line through the Look `composer.empty`, `(width) => line`, of the type `EmptyLook`. It is drawn after the cursor, and given the cells left. Its default draws nothing. This one shows a hint:

  ```js
  ctx.binnacle.look('composer.empty', () => () => ctx.binnacle.paint('dim', 'Ask anything'))
  ```

- The draft's rows draw through two Looks, from `@easeshine/binnacle/plugins/composer`:
  - `composer.prefix`, `() => ({ first, rest })`, of the type `DraftPrefixLook`: `first` draws before the draft's first row, and `rest` before each row after it. With no `rest`, the rows after the first start under the draft. The draft wraps in the cells left beside the wider prefix, and the cursor moves with it. An empty draft draws `first` before its cursor. Its default draws none.
  - `composer.row`, `(row, { index, more }) => row`, of the type `DraftRowLook`: one row of the draft, as the editor drew it, with the cursor's cell in it. `index` is the row's place among the rows shown. `more` is `true` for a row such as `↑ 3 more`, which tells the rows of a tall draft hidden above or below. Its default draws `more` rows in the `muted` Tone, and the others as they are. Add no cells to a row: it is as wide as the cells left, and a wider row wraps.

  This draws a `› ` before each row of the draft, and its text in the `accent` Tone:

  ```js
  ctx.binnacle.look('composer.prefix', () => () => ({ first: '› ', rest: '› ' }))
  ctx.binnacle.look('composer.row', (beneath) => (row, at) => (at.more ? beneath(row, at) : ctx.binnacle.paint('accent', row)))
  ```

- To replace the composer whole, turn the row `binnacle-composer` off, and draw an editor of your own in `composer.input`. `Editor`, the editor that the composer draws, is exported from `binnacle`, with its theme's type `EditorTheme`. It marks its cursor in its lines with `CURSOR_MARKER`. Take the mark out of each line, and give the Place its column as the cursor:

  ```js
  import { CURSOR_MARKER, Editor, visibleWidth } from '@easeshine/binnacle'

  const plain = (text) => text
  let placed
  const editor = new Editor({ requestRender: () => placed?.redraw(), terminal: { rows: 24 } }, {
    selectList: { selectedPrefix: plain, selectedText: plain, description: plain, scrollInfo: plain, noMatch: plain },
  })
  editor.focused = true
  editor.onSubmit = (text) => ctx.get('binnacleSession')?.send(text)
  ctx.binnacle.layout('composer', { row: [{ place: 'composer.input' }] })
  placed = ctx.binnacle.place('composer.input', {
    lines: (width) => editor.render(width).map((line) => line.replace(CURSOR_MARKER, '')),
    cursor: (width) => {
      const lines = editor.render(width)
      const line = lines.findIndex((text) => text.includes(CURSOR_MARKER))
      return line === -1 ? undefined : { line, column: visibleWidth(lines[line].slice(0, lines[line].indexOf(CURSOR_MARKER))) }
    },
    key: (data) => {
      editor.handleInput(data)
      placed.redraw()
      return true
    },
  })
  ```

  The editor reads its keys from the Gesture Table, such as `tui.input.submit` for enter. The built-in composer adds the model `composer`, its actions, a command line run through dsh, and the keys that it passes on to other actions.
