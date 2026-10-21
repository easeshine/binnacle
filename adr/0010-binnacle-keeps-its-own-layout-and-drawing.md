# binnacle keeps its own layout and drawing, and an author imports no terminal library

**Status:** accepted, 2026-10-20

binnacle's core lays out each Screen and draws it. It copies only the lower-level parts of pi-tui: the decoding of keys, the width of text, the editor and the conversion of colours. What an author imports is binnacle's own, and it holds no type of a terminal library. A library may go beneath the core later, if what an author imports does not change.

## Why

- An author changes one piece of a built-in while binnacle runs: a Look, an action that runs the one beneath it, or an edit of one node. No terminal library has this. Each one gives a tree of components, and each component decides its own children. binnacle would build its own way to change a piece on top of any of them.
- Only a renderer that binnacle owns can say what drew each cell, down to its Look and its Tone. An author agent learns from this what a person points at.
- binnacle can catch a failure in each Part, each Look and each action, and name its plugin. A library's tree catches a failure only at a subtree, and a Look runs inside another plugin's subtree.
- A type of a library in what an author imports binds every author to the releases of that library. When the library breaks its API, every author breaks with it.
- binnacle is an ordinary dsh profile, and it runs in the Node process that dsh starts. A library that needs a newer Node, or a flag on that process, would change dsh.

## Considered options

- **OpenTUI.** A native core draws cells fast and lays them out with Yoga, and React or Solid draws on it. It runs best on Bun. On Node, it needs a newer Node than dsh supports and an experimental flag on the process. It ships a native package for each platform.
- **Ink.** React on Node, with Yoga for layout, and agents know React well. But each component decides its children, the state that React keeps does not fit the hot reload of Cordis, and a cell does not know what drew it.
- **Yoga, under binnacle's own components.** It would replace the smallest layer. Its rules for a terminal that is too small are not binnacle's, so binnacle would still write its own rules around it.
- **pi-tui's renderer and components.** A component of pi-tui draws whole, and pi gives an extension no piece of it. An author then copies a built-in or patches it at runtime.

## Consequences

- binnacle owns the layout, the draw, the Focus and the gestures, and each bug in them.
- The copied parts of pi-tui stay copies, with credit. They move away from pi-tui where binnacle needs them to, as the editor's keys must.
- A new feature of the terminal, such as a faster draw or images, is binnacle's to build, or a library's to give beneath the core.
- What an author imports holds no type of a library. A change to what an author imports is a one-way door.
