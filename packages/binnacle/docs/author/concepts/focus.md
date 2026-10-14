# The Focus and the scroll

```js
const handle = ctx.binnacle.place('preview', preview)
handle.focus()
ctx.binnacle.focus('composer.input')
ctx.binnacle.scroll('transcript', -1)
```

- `binnacle.focus(place)` moves the Focus to the Place by that name, as a click does. The Handle that `binnacle.place(name, part)` returns has `focus()`, which moves the Focus to its own Place.
- A Place that is not drawn yet, or that takes no keys yet, takes the Focus once it draws and takes keys. The Focus moved is forgotten after its Place has had it and stopped taking keys. Then the Focus goes back to the Screen's own, else to the first Place that takes keys.
- `binnacle.scroll(place, pages)` scrolls the Place by that name by pages, and stops at its first and its last line. A positive `pages` moves toward the last line, as page down does, and a negative one toward the first. A page is as many rows as the Place's box shows, from the rows it shows now.
- A scroll of a Place that is not drawn, or that has no rows of room, does nothing. A scroll never moves the Focus.
- `binnacle.focusMovedLast()` is the Place that a person or an author last moved the Focus to on the Screen on view, kept after the core forgets the move, or `undefined` if no one moved it. The Requests' view reads it to leave a Focus that a plugin moved.
- `binnacle.linesShown(place)` is how many of the Part's lines the Place shows now, a wrapped line counted once, or `undefined` while the Place is not drawn. The List reads it for its page, and the offer of commands for whether it draws.
- A Place with the Focus shows its Part's cursor. After `binnacle.scroll`, it shows the rows paged to, until the Part's cursor moves to another line or column, as when a key moves it. Then it follows the cursor again. The wheel follows the cursor, as before.
