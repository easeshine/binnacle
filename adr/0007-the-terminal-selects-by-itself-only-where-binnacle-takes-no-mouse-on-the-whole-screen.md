# The terminal selects by itself only where binnacle takes no mouse on the whole screen

**Status:** accepted, 2026-10-14

A terminal reports the mouse for the whole screen or not at all. So binnacle asks for mouse reports while a Place on view takes the mouse, and for none while no Place does. With none, the terminal selects by itself. While one Place takes the mouse, a part of the screen where the mouse does nothing, by an author's `mouse: false`, is left to the terminal's own bypass, such as shift and a drag.

An author gives the mouse back with `mouse: false` on the root of the Screen's Layout. binnacle asks for reports again when a Place takes the mouse.

## Considered options

- **Reports off while the pointer is over a part that takes no mouse.** With the reports off, the terminal cannot tell binnacle where the pointer went, so binnacle can never turn them on again.
- **An option of the core's that gives the mouse back.** It says what the Layout already says, a second time.

## Consequences

- A part with `mouse: false` beside a Place that takes the mouse is not selected by a plain drag. A person uses the terminal's bypass there.
- With the mouse given back, a click and the wheel do nothing in binnacle. What the terminal sends for the wheel then is the terminal's to decide.
- A change to it is a one-way door: it changes what `mouse: false` on a Screen's root does for an author.
