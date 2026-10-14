# Using binnacle

binnacle is a terminal app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). It draws a session: the transcript, what you type, and what the agent asks.

- Start binnacle with `dsh --profile binnacle`. It opens the Chat on a new session.
- Open a stored session with `dsh --profile binnacle --session <id>`. It is drawn, and nothing can be sent to it.
- Scroll the Place under the pointer with the wheel.
- Keep your place in a Place that follows a cursor, such as a List's: its view moves only as far as the cursor needs. The transcript keeps its Marked event's header on the top row.
- Suspend binnacle with ctrl+z, and come back to it.
- Get the terminal back as it was when binnacle exits, crashes or is suspended. What other code wrote while binnacle drew is written after, in order.

## Features

Each feature is a plugin with a row of its own in binnacle's `cordis.patch.yml`. Turn a feature off by its row, in your profile's `cordis.patch.yml`:

```yaml
- id: binnacle-status-line
  disabled: true
```

The core, row `binnacle`, cannot be turned off: it owns the terminal, and every feature needs it.

| Feature | Rows | Page |
|---|---|---|
| Core | `binnacle` | [index.md](index.md) |
| Gestures | `binnacle` | [keys.md](keys.md) |
| Kit | `binnacle` | [keys.md](keys.md) |
| Transcript | `binnacle-transcript`, `binnacle-transcript-view` | [transcript.md](transcript.md) |
| Tool cards | `binnacle-tool-cards` | [tool-cards.md](tool-cards.md) |
| Composer | `binnacle-composer` | [composer.md](composer.md) |
| Commands | `binnacle-commands` | [commands.md](commands.md) |
| Status line | `binnacle-status-line` | [status-line.md](status-line.md) |
| Requests | `binnacle-requests`, `binnacle-requests-view` | [requests.md](requests.md) |
