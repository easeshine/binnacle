# Colours

Rows `binnacle`, `binnacle-palette`, `binnacle-skill`. To change colours in a plugin, see [the theme, for authors](../author/concepts/theme.md).

binnacle draws in the terminal's own colours until you pick a palette or change them. Your palette and your own colours go in `palette.json`, in binnacle's profile: `~/.dsh/profiles/binnacle/palette.json`.

```json
{
  "palette": "pi/dark",
  "hues": { "orange": "#ff8700" },
  "colors": { "transcript.card.error": "orange", "mdHeading": { "color": "green", "bold": true } }
}
```

- `palette` names the palette that you picked, as `<source>/<name>`, such as `pi/dark`. With no `palette`, binnacle draws in the terminal's own colours ([Pick a palette](#pick-a-palette)).
- Give a Tone a colour under `colors`, by its name, such as `mdHeading` or `transcript.card.error`. [The theme](../author/concepts/theme.md#the-tones) lists the Tones, and the page of each feature for authors lists its own Tones.
- A colour is a Hue by name, such as `green` or `orange`; a 256-colour index, such as `67`; or an exact colour, such as `#ff00ff`.
- Give a Tone a Style in place of a colour: `{ "color", "background", "bold", "dim", "italic", "underline", "inverse", "like" }`. `like` names another Tone, and the Tone draws as that Tone, with its own colour and attributes over it.
- Give a Hue its colour under `hues`: a 256-colour index or an exact colour. Each Tone in that Hue changes, as `"orange": "#ff8700"` changes `syntaxString` and each Tone that you gave `"orange"`. A Hue is one of the terminal's sixteen, `black` to `bright-white`, or `orange`.
- Your colours win over the palette's colours, and over the colours of every feature and every plugin.
- Save the file, and binnacle draws in your colours at once, while it runs.
- Leave out the file, or leave it empty, and binnacle draws in the terminal's own colours.

## Pick a palette

Type `/palette`. A List of palettes opens above the composer, with the palette in use marked:

```text
› Terminal
  dark — pi
  light — pi
  mine — pi-themes
```

- `Terminal` is the terminal's own colours. `dark` and `light` are pi's own palettes. Then each of your own pi themes is listed by its file's name: each `*.json` in `~/.pi/agent/themes/`, or in the `themes` folder of `$PI_CODING_AGENT_DIR`. Then the palettes of each plugin that adds them.
- Move the mark with up and down, and binnacle draws in the marked palette at once, with your own colours over it. They wrap.
- Press enter, and the palette is kept: `palette.json` names it, and the List closes. Each other key in the file stays as it is. Enter on `Terminal` takes `palette` out of the file.
- Press esc, and binnacle draws in the palette that `palette.json` names. The file does not change.
- Your own colours stay when you pick another palette. A colour that names a Hue, such as `"mdHeading": "green"`, follows the new palette's green. An exact colour, such as `"#ff00ff"`, stays as it is. A Hue of yours under `hues` stays too.
- A palette that does not load, such as a pi theme that is not JSON, shows what is wrong beside it when the mark is on it, and binnacle keeps the colours that it drew. Enter on it keeps the List open, and the file as it was.
- binnacle reads a pi theme only when the mark moves to it, or when `palette.json` names it at the start. Change a pi theme, and see it at the next mark on it.
- While the List is open, save `palette.json`, and your colours follow at once.
- A Request that comes stands in the composer's place, and the List goes with the composer. When the Request goes, the List is back, with its mark.
- When `palette.json` names a palette that is not there, or that does not load, binnacle draws in the terminal's own colours, with yours over them, and the status line says which palette and why: `palette.json: no palette pi-themes/mine`, or `palette.json: pi-themes/mine: not JSON`.
- Turn the row `binnacle-palette` off, and `/palette` is no command. `palette.json` still applies, and a palette of pi's draws in the terminal's own colours.

## Ask the agent

Ask the Chat's agent for a change of colour in your own words, such as `make the errors on tool cards orange`. The agent has binnacle's skill in every session: it loads the skill, finds the Tone, and writes it under `colors` in `palette.json`, beside your own colours, here `"transcript.card.error": "orange"`. Once it saves, binnacle draws in it, as when you save the file. The agent changes only the Tone it names, so the `✗` of a failed read stays in `error`. Delete the line, and save, to undo it.

Turn the row `binnacle-skill` off, and the agent does not know binnacle.

## A mistake in the file

When the file is not JSON, or it holds a key, a Hue or a colour that is not one, binnacle keeps the colours that it drew. A palette that you pick then is not written to the file. The status line says what is wrong, and where, in the Tone `status.error`:

```text
palette.json: the Tone mdQuote is not a colour: '#00fff'
```

Correct the file, and save it. The colours follow it, and the warning goes. binnacle also refuses a `like` that makes a loop, such as `a` like `b` and `b` like `a`, with your own Tones or with a feature's, and a Tone's old name, such as `heading` for `mdHeading`. When your colours make a loop with a feature that loads after them, binnacle draws in the terminal's own colours until you correct the file. When binnacle cannot read the file, as when `palette.json` is a folder, it keeps the colours that it drew, and the status line says why.
