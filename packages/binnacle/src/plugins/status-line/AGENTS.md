# Status line: how it is built

Row `binnacle-status-line` · Intent: [Authoring](../../../../../intents/authoring/intent.md). For a person: `docs/use/status-line.md`. For an author: `docs/author/built-ins/status-line.md`.

- It sets the Layout `status`, `STATUS_LAYOUT`: a row with `separator: true` and the Places `status.state` and `status.model`. The Chat draws it with `{ layout: 'status', size: 'content' }`. Turned off, the row leaves no status line, as the Layout `status` is not set.
- Each segment is a Part with one line: its Look, found by `lookOf([place])`, given the value made plain. The default Look draws the value in the `text` Tone. `status.state` is given the agent's status, or `read only` on a stored session. `status.model` is given the model, or the stored session's id. A segment with no value draws nothing, and takes no divider.
- The agent's status and model are Untrusted Text, made plain with `toPlainText` before the Look is given them.
- Both segments draw again on `agent/status` for the Chat's agent.
- The core's separated row joins the segments and cuts the line ([Core](../../core/AGENTS.md)).
