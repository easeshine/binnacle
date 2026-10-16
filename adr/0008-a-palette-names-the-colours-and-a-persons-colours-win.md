# A palette names the colours, and a person's colours win

**Status:** accepted, 2026-10-15

binnacle's colours are a Palette of named Hues. Tones name the Hues, and the colours that a person chooses win over the colours that a plugin sets.

- A **Palette** is the colours of the theme. It holds no glyph, edge or spacing. A **Hue** is one named colour of a Palette, such as `orange`.
- A Tone names a Hue or an exact colour, and its attributes. A change to a Hue changes each Tone that names it.
- The Tones are pi's whole set, with pi's names. A feature picks its colours from them. binnacle does not add pi's colours one at a time, as features need them.
- A plugin's colour lies on a Tone, as an instance's Look lies on its kind's: `tool-cards.error` falls back to `error`. A plugin may add a colour of its own, with a Tone as its default.
- The layers, from the lowest: binnacle's defaults, a plugin's defaults for its own colours, the Palette that the person picked, and the person's changes. A plugin sets only the defaults of its own colours.
- The person's changes are a layer apart from the Palette, and stay when the person picks another Palette. A change that names a Hue follows the new Palette. An exact colour stays.
- An agent writes a person's colour change into the person's changes, not into a plugin of its own.
- A Palette comes from a source. Any plugin may add a source.

## Why

In a blind trial of tool cards, three authors of three model families each needed a colour behind a line, and binnacle had none. One wrote raw escape codes, one drew a Tone in inverse video, and one coloured a frame's edge. None of the three followed the person's theme. An earlier trial recoloured one component with a raw colour, as a Tone could change only for everything. Each workaround drew a colour that the person could not change.

With Hues behind the Tones, one change to a Hue reaches every Tone and every plugin colour that names it. A Palette that comes from somewhere else only has to fill the Hues. A person who changes a colour changes it in one place, and a plugin installed later cannot undo it.

## Considered options

- **A Tone is a colour itself, as before.** A Palette from elsewhere must then set each Tone, and a person cannot change one Hue everywhere.
- **The newest layer wins, as before.** A plugin's layer then hides the person's choice, and the person cannot tell which plugin did it.
- **Add pi's colours as features need them.** Each feature must then check pi again, and the names drift.
- **Keep binnacle's own names for four Tones.** A table between binnacle's names and pi's must then be kept for every Palette from pi.
- **A person's changes belong to one Palette.** A person who asked for orange errors then loses them when they pick another Palette.

## Consequences

- `heading`, `code`, `link` and `selection` take pi's names. This is a break of what an author may import.
- A plugin's theme layer no longer changes a Tone over the person's Palette. It sets only the defaults of the plugin's own colours.
- Some Tones are drawn by no built-in yet. Each one is in the docs for authors with what it is for, so that a feature that needs it finds it.
- A source that turns another app's theme into a Palette must give every Hue and Tone a colour that a person can see and change.
