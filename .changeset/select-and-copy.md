---
'@easeshine/binnacle': patch
---

Select and copy with the mouse. A drag selects in the part of the screen where it began, a double click selects a word, and a triple click a line. Letting go copies the Selection to the clipboard, through the system's own tool, or OSC 52 over SSH, and the status line says how it went. A click now acts when the button is let go. An author reads the model `selection`, binds or replaces the action `copy.selection` of the new row `binnacle-copy`, paints the Tone `selection`, and gives the mouse back to the terminal with `mouse: false` on a Screen's root. The test kit adds `drag` and `copied`.
