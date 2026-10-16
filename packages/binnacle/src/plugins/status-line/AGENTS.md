# Status line: how it is built

Row `binnacle-status-line` · Intent: [Authoring](../../../../../intents/authoring/intent.md). For a person: `docs/use/status-line.md`. For an author: `docs/author/built-ins/status-line.md`.

- It sets the Layout `status`, `STATUS_LAYOUT`: a row with `separator: true` and the Places `status.state`, `status.model` and `status.copy`. The Chat draws it with `{ layout: 'status', size: 'content' }`. Turned off, the row leaves no status line, as the Layout `status` is not set.
- Each segment is a Part with one line: its Look, found by `lookOf([place])`, given the value made plain. The default Look draws the value in the status line's own Tone `status.text`. `status.state` is given the agent's status, or `read only` on a stored session. `status.model` is given the model, or the stored session's id. A segment with no value draws nothing, and takes no divider.
- The agent's status and model are Untrusted Text, made plain with `toPlainText` before the Look is given them.
- Both segments draw again on `agent/status` for the Chat's agent.
- **`status.copy`** reads the model `copy` of the row `binnacle-copy` with `modelOf('copy')`, and the core's `clock`. It shows the newest copy's outcome for two seconds from its `at`, or five for a failure, as pi flashes its notice: `copied` in `status.success`, `sent to the terminal` in `status.muted`, `copy failed: <reason>` in `status.error` (`NOTICES`). It reads the clock only while a notice can show, so the clock stops after. The clock ticks a second after it last changed, so a notice goes up to a second late. The reason is made plain. With the row `binnacle-copy` off, it draws nothing.
- **Its own Tones**, `status.text`, `status.success`, `status.muted` and `status.error`, are each `{ like: <the general Tone> }` in a theme layer that the row adds once the session opens, beside its Layout, so an author's layer, ranked above it, wins.
- The core's separated row joins the segments and cuts the line ([Core](../../core/AGENTS.md)).
