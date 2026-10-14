# A click acts on its release, and a press that moves selects

**Status:** accepted, 2026-10-14

A click acts when the button is let go, on the cell where it was pressed. A press that moves to another cell before its release is a drag: it selects text, and clicks nothing. In a double or a triple click, only the first click acts, and the others only select. This holds for every Part and every action that takes a click: a fold, a pick, a Mark, an author's own.

## Considered options

- **A click acts on its press**, as binnacle did before. Every drag that starts on a tool card's first line would fold the card, and a drag across a Request's Choices would pick one.
- **A drag only with a modifier**, such as alt. A person's plain drag then does nothing, which a plain terminal never does.

## Consequences

- A click acts a little later than before: on its release.
- A second click on the same word within 500 ms is a double click. It selects the word, and does not act. A person who clicks twice fast to fold and unfold waits a moment between.
- What a test sends as a click is a press and its release.
- Every Spec that takes a click is held to it.
- A change to it is a one-way door: an author's action that takes a click acts on the release.
