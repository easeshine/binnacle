# Tool cards

Row `binnacle-tool-cards`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/tool-cards.md).

- See each colour of a card in a Tone of the card's own, such as `transcript.card.error`, which looks like the general Tone of its name, `error`, until a theme changes it. A diff's counts are in `toolDiffAdded` and `toolDiffRemoved`, the title in `toolTitle`, and a shell's output in `toolOutput`, which look as `success`, `error` and the terminal's own text do. [The tool cards' page for authors](../author/built-ins/tool-cards.md) lists them.
- See each tool call and its result as one card, where the call is in the transcript, with the row `binnacle-tool-cards` on, as binnacle ships it: its first line, its body, then a blank line.
- Read on a card's first line `⏺ ` and the tool's title, cut at the width. The title is the one that dsh's view of the call gives, or the tool's name. The `⏺` is in the Tone `transcript.card.accent` while the call runs, `transcript.card.success` when it is done, and `transcript.card.error` when it failed. A shell command that ended with an exit code other than 0, or with a signal, failed. A card that is done ends its first line with how long the call took, in the `transcript.card.muted` Tone: ` · 1.2s` under a minute, ` · 1:15` after.
- Read a card's body, each line after `  ⎿ ` for the first and `    ` for the rest, as the result's card kind says:
  - a shell command's last 12 lines of output in the `toolOutput` Tone, after `… <n> earlier lines` in `transcript.card.muted` when there are more, and `exit <code>` or `signal <name>` in the `transcript.card.error` Tone when it did not exit with 0;
  - a diff's line for each file, `<path> +<added> -<removed>`, the counts in the `toolDiffAdded` and `toolDiffRemoved` Tones;
  - a search's `<n> matches` or `<n> paths`, and ` (truncated)` in the `transcript.card.warning` Tone when dsh cut it;
  - a read's `<n> lines of <total>`;
  - a web retrieval's title, then the first 12 lines of its text;
  - a todo list's items, one a line: `[x]` and the item in the `transcript.card.muted` Tone when it is completed, `[ ]` and the item in `transcript.card.accent` when it is in progress, `[ ]` and the item when it is pending;
  - a question's text, then `→ ` and its answer once it came: the choices selected, then the person's own text, joined by `, `;
  - any other tool's title, when its view has one, then the first 12 lines of its text, or, when its text is JSON, a line for each key, `key: value`.
- While a call runs, read what it does: a shell command's description and working directory, a diff's line for each file, or the call's input, a line for each key, `key: value`. A card with no body draws its first line alone.
- Fold a card's body with enter on the Marked card, or with a click on its first line. A todo card and an ask card do not fold: a click on them only Marks them. The card then draws its first line alone, which ends with `(1 line)` or `(<n> lines)`. Again, and it unfolds. The Mark moves between cards as between events.
- Read a stored session's cards the same way, with the times the calls took. A call that never got a result draws no time.
- Watch the call that streams as the view draws it, `⏺ <tool>(<the arguments so far>)`. Its card takes its place once it commits.
- Turn the row `binnacle-tool-cards` off, and read a call and its result as two lines again, as [Transcript](transcript.md) draws them.
