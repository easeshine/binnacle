---
'@easeshine/binnacle': patch
---

A person runs `/palette`, and picks a palette from a List above the composer: `Terminal`, pi's `dark` and `light`, and their own pi themes. binnacle draws each palette as the mark moves to it, with the person's own colours over it, enter keeps it in `palette.json`, and esc goes back to the palette that the file names. A file that names a palette that is not there draws in the terminal's colours, and the status line says why. An author adds a source of palettes with `binnacle.palettes(source)`, and shows or picks one with `binnacle.showPalette(id)` and `binnacle.pickPalette(id)`. The new row is `binnacle-palette`.
