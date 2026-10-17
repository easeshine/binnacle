# A palette names the colours, and a person's colours win

**Status:** accepted, 2026-10-15. Rewritten 2026-10-16, after the palette's first two Stages were built.

binnacle draws in Tones, which are named by what is drawn in them. A Palette gives the Tones their colours. The person's own colours win over every Palette and every plugin. A feature has Tones of its own, which follow the general Tones until the person changes them.

## Why

In a blind trial of tool cards, three authors of three model families each needed a colour behind a line, and binnacle had none. One wrote raw escape codes, one drew a Tone in inverse video, and one coloured a frame's edge. An earlier trial recoloured one component with a raw colour, because a Tone could change only for everything. Each workaround drew a colour that the person could not change, and that no theme reached.

So the person must own every colour, in one place, and nothing that an author writes can take it from them. An author must also have a colour for each meaning, and a colour for each feature, so that no author needs a raw colour.

## The decisions

- **The person's colours rank above every plugin, and binnacle holds them.** No plugin can put a layer above them, so a plugin installed later cannot hide a person's choice. When the newest layer wins, the person cannot tell which plugin undid their change.
- **The person's colours are a layer apart from the Palette.** They stay when the person picks another Palette. A colour that names a Hue follows the new Palette's Hue, and an exact colour stays as it is. A person who asked for orange errors keeps them in every Palette.
- **The agent writes into the person's colours.** A change that a person asks the agent for is the person's change. The person reads it and undoes it in the same place as their own edits.
- **The Tones are pi's whole set, with pi's names.** A Palette made for pi then has a place for each of its colours, with no table between two sets of names. A feature that needs a colour of a new meaning, such as a line added to a file, finds one.
- **A feature's own colours are Tones, named as its Looks are, and each one looks like a general Tone.** A person changes the errors everywhere, or only the errors on tool cards. Until they change a feature's own Tone, it follows the general one. An author finds a feature's Tones under the names where they find its Looks.
- **The Hues are a fixed list: the terminal's sixteen, and orange.** A person's "the Palette's orange" must find an orange in every Palette. With an open list, each Palette names its own Hues, and a person's Hue finds nothing in the next one. The sixteen have no orange, and a warning often wants one.
- **A Palette holds only colours.** The glyphs, the edges and the spacing stay apart. A theme from another app knows only colours, and a person who changes colours does not change how binnacle is laid out.
- **Palettes come from Sources that any plugin can add.** binnacle cannot know each app whose themes a person likes. A Source lists its Palettes without reading them, and loads one only when it is asked, so a slow or broken theme costs nothing until the person moves to it. Only the newest request draws, so a person who moves fast through the list sees the Palette that they are on.

## Considered options

- **The newest layer wins, as before.** A plugin's layer then hides the person's choice, and the person cannot tell which plugin did it.
- **A layer has a rank that a plugin gives.** A plugin can then take the top rank too, and the person's colours become one plugin among others.
- **A person's colours belong to one Palette.** A person who asked for orange errors loses them when they pick another Palette.
- **The agent writes a plugin of its own.** Its layer is then below the person's colours, among the plugins, and the person must find it to undo it.
- **A feature draws only the general Tones.** A person cannot then change one feature alone, and authors write raw colours again, as the trials did.
- **Add pi's colours as features need them.** Each feature must then check pi again, and the names drift.
- **Keep binnacle's own names for four Tones.** A table between binnacle's names and pi's must then be kept for every Palette from pi.
- **Each Palette names its own Hues.** A person's change to a Hue then holds in one Palette only.
- **binnacle ships a fixed set of Palettes.** A person who likes a theme from another app must then copy it by hand.

## Consequences

- Four Tones took pi's names. This broke what an author may import.
- A plugin's layer can still change a general Tone, but the Palette that the person picks lies over it. A Tone that the Palette gives draws in the Palette's colour, whatever the plugin set.
- A Palette from another app gives each Tone the exact colour that the app draws. A Hue of the person's then changes only the Tones that the person put in that Hue, not the Palette's own.
- Some Tones are drawn by no built-in yet. The docs for authors list each one with what it is for, so that a feature that needs it finds it.
- Each new Source, such as one for another app's themes, fills the same Tones, and must give each one a colour that a person can see and change.
