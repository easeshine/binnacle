# Copying

The core holds the Selection, and the row `binnacle-copy` copies it. For a person, see [Select and copy](../../use/copy.md).

## The Selection

A drag selects in the Place where it was pressed, and a double click or a triple click selects a word or a line. The core names the model `selection`. Its state's `selected` is the Selection, `{ place, text }`, or `undefined` while there is none:

```js
const selection = ctx.binnacle.modelOf('selection')
ctx.binnacle.place('chars', {
  models: [selection],
  lines: () => [`${selection.state?.selected?.text.length ?? 0} selected`],
})
```

- `text` is the rows as drawn, plain, one line for each row, with no blanks at a row's end.
- It changes while the drag grows, and is `undefined` again once the Selection clears.
- `set` on it does nothing. The type of its state is `SelectionState`.
- A release that ends with a Selection fires the gesture `select` to the actions with no Place, as the wheel fires `wheelup` and `wheeldown`.
- The Selection is drawn in the Tone `selection`, `{ inverse: true }` by default ([The theme](../concepts/theme.md)).

## The action `copy.selection`

The row sets the action `copy.selection`, bound to `select`, with no Place. It is enabled only while a Selection is held. It copies the Selection's text to the clipboard. A text of blank rows copies nothing.

- Copy with a key instead of on the release. A binding to a list replaces `select`, so a release copies nothing, and the key copies:

  ```js
  ctx.binnacle.bind('copy.selection', ['ctrl+o'])
  ```

  With no Selection, the action is not enabled, so the key goes on to the next action.

- Copy on the release and with a key: `ctx.binnacle.bind('copy.selection', (keys) => [...keys, 'ctrl+o'])`.
- Replace how text reaches the clipboard. Set the action with a `run` of your own: it keeps the keys and the gate of the row's. A release runs it, and binnacle's clipboard is not written:

  ```js
  import { appendFileSync } from 'node:fs'

  const selection = ctx.binnacle.modelOf('selection')
  ctx.binnacle.action('copy.selection', {
    run: () => appendFileSync('/tmp/copied.txt', `${selection.state.selected.text}\n`),
  })
  ```

- Turn the row off, and a drag still selects, and copies nothing.

## The model `copy`

The row names the model `copy`, `{ last }`: the newest copy that finished, `{ outcome, reason, at }`. `outcome` is `copied` when a tool of the system copied, `sent` when only the terminal was asked to, with OSC 52, and `failed` when neither could be done, with `reason`. `at` is when it finished, on the core's clock. A copy started after another wins. The type of its state is `CopyState`, exported from `@easeshine/binnacle/plugins/copy`.

The status line shows it in the segment `status.copy` ([The status line](status-line.md)).

## How a copy reaches the clipboard

binnacle copies as pi does, with credit:

- Each tool runs with no shell, given the text on its stdin, and is killed after 3 seconds. The first that works wins.
- On macOS, `pbcopy`. On Linux, `termux-clipboard-set` in Termux, `wl-copy` under Wayland, then `xclip`, then `xsel` under X.
- On Windows, and in WSL with no display, PowerShell reads the text from a UTF-8 file in the temporary folder, readable only by the person, into `Set-Clipboard`, and is killed after 5 seconds. The file is removed after. WSL gives PowerShell the file's Windows path from `wslpath -w`.
- Over SSH or mosh, and where no tool copied, binnacle asks the terminal with OSC 52. Its base64 is at most 100 000 bytes. Longer, where no tool copied, the copy fails as `too long for the terminal`.
- The text is made plain before it is copied, and OSC 52 carries base64 only.

## Clicks, and the mouse given back

- A click acts on the release, on the cell where it was pressed. A press that moves selects, and clicks nothing. In a double or a triple click, only the first click acts.
- A drag that begins in a node with `mouse: false`, or on no Place, selects nothing. A node with `clicks: false` still selects.
- `mouse: false` on the root of the Screen's Layout gives the mouse back to the terminal: binnacle asks for no mouse reports while no Place on view takes the mouse, so the terminal selects by itself. It asks again when a Place takes the mouse ([Layouts](../concepts/layouts.md)).

## Testing

`mount` from `@easeshine/binnacle/testing` sends a drag with `drag(from, to)`, and `copied` lists each text that reached the clipboard. The mount's clipboard always copies ([A plugin](../plugin.md)).
