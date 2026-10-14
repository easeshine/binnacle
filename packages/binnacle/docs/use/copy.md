# Select and copy

The Selection is in the core, row `binnacle`. Copying is row `binnacle-copy`. To turn copying off, see [Features](index.md#features). With it off, a drag still selects, and copies nothing. To change it, see [its page for authors](../author/built-ins/copy.md).

## Select

- Drag across text to select it. The Selection is drawn inverse, on the selected text only, and nothing else changes.
- A Selection stays in the part of the screen where the drag began, such as the transcript or the composer. A drag past its edge selects to the edge, and never a row of another part.
- Hold a drag above or below the part where it began: the part scrolls one row every 50 ms, and the Selection grows with it.
- Double-click a word to select it. A path, or a name with hyphens, stays whole.
- Triple-click a line to select it, with every row that it wraps to.
- A drag after a double click grows the Selection by words, and after a triple click by lines.
- A drag that begins over the offer of commands, or over another part drawn on top, selects in that part.

## Copy

- Let go after a drag, a double click or a triple click: the Selection is copied to the clipboard. What is copied is the text as drawn, with no colours, one line for each row, with no spaces at a row's end.
- See `copied` in the status line for two seconds. See `sent to the terminal` when binnacle only asked the terminal to copy, as over SSH, where it cannot know if the terminal did.
- See `copy failed:` and why for five seconds when the copy cannot be done, such as `copy failed: too long for the terminal`.
- Paste with the terminal's own paste, such as cmd+v.

binnacle copies with the system's own tool:

| System | Tool |
|---|---|
| macOS | `pbcopy` |
| Windows | PowerShell |
| Linux in Termux | `termux-clipboard-set` |
| Linux under Wayland | `wl-copy` |
| Linux under X | `xclip`, then `xsel` |
| WSL with no display | PowerShell |

Over SSH or mosh, binnacle also asks the terminal to copy, with OSC 52. Where no tool copies, it asks the terminal instead. A terminal copies for an app only if it allows it, as Ghostty and kitty do, and iTerm2 does when you allow it. A text longer than about 75 000 characters is too long for the terminal.

## Clicks

- A click acts when you let go, on the cell where you pressed. A press that moves selects, and clicks nothing.
- In a double or a triple click, only the first click acts. The second and the third only select.
- The next press anywhere clears the Selection.

## When the Selection clears

- It stays while you type, press esc, turn the wheel, or new output comes below it.
- It clears at the next press, at a resize, when another Screen is shown, and when the text under it changes, such as after a fold above it or as you type in the draft that it covers.

## Select as the terminal does

Where binnacle takes the mouse, use the terminal's own bypass, such as shift and a drag, to select as the terminal does, across the whole screen. Where an author gives the mouse back to the terminal on the whole screen, a plain drag selects as the terminal does, and clicks and the wheel do nothing in binnacle.
