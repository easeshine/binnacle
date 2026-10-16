# Colours

Row `binnacle`. To change colours in a plugin, see [the theme, for authors](../author/concepts/theme.md).

binnacle draws in the terminal's own colours until you change them. Your own colours go in `palette.json`, in binnacle's profile: `~/.dsh/profiles/binnacle/palette.json`.

```json
{
  "hues": { "orange": "#ff8700" },
  "colors": { "transcript.card.error": "orange", "mdHeading": { "color": "green", "bold": true } }
}
```

- Give a Tone a colour under `colors`, by its name, such as `mdHeading` or `transcript.card.error`. [The theme](../author/concepts/theme.md#the-tones) lists the Tones, and the page of each feature for authors lists its own Tones.
- A colour is a Hue by name, such as `green` or `orange`; a 256-colour index, such as `67`; or an exact colour, such as `#ff00ff`.
- Give a Tone a Style in place of a colour: `{ "color", "background", "bold", "dim", "italic", "underline", "inverse", "like" }`. `like` names another Tone, and the Tone draws as that Tone, with its own colour and attributes over it.
- Give a Hue its colour under `hues`: a 256-colour index or an exact colour. Each Tone in that Hue changes, as `"orange": "#ff8700"` changes `syntaxString` and each Tone that you gave `"orange"`. A Hue is one of the terminal's sixteen, `black` to `bright-white`, or `orange`.
- Your colours win over the colours of every feature and every plugin.
- Save the file, and binnacle draws in your colours at once, while it runs.
- Leave out the file, or leave it empty, and binnacle draws in the terminal's own colours.

## A mistake in the file

When the file is not JSON, or it holds a key, a Hue or a colour that is not one, binnacle keeps the colours that it drew. The status line says what is wrong, and where, in the Tone `status.error`:

```text
palette.json: the Tone mdQuote is not a colour: '#00fff'
```

Correct the file, and save it. The colours follow it, and the warning goes. binnacle also refuses a `like` that makes a loop, such as `a` like `b` and `b` like `a`, with your own Tones or with a feature's, and a Tone's old name, such as `heading` for `mdHeading`. When your colours make a loop with a feature that loads after them, binnacle draws in the terminal's own colours until you correct the file. When binnacle cannot read the file, as when `palette.json` is a folder, it keeps the colours that it drew, and the status line says why.
