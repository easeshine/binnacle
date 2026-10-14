# Using binnacle

binnacle is a terminal app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). It draws a session: the transcript, what you type, and what the agent asks.

## Install and start

binnacle runs on dsh, and dsh installs binnacle with pnpm. binnacle installs neither of them. Install [pnpm](https://pnpm.io/installation), then dsh and binnacle:

```sh
npm install -g @deepseek-ai/dsh @easeshine/binnacle
```

- Start binnacle with `binnacle`. It opens the Chat on a new session.
- Open a stored session with `binnacle --session <id>`. It is drawn, and nothing can be sent to it.
- See binnacle's flags with `binnacle --help`, and its version with `binnacle --version`.

Each time it starts, binnacle checks two versions:

- **dsh's.** binnacle runs on a narrow range of dsh versions. When dsh is not one of them, binnacle says which dsh to install, and does not start. It never runs on a dsh outside its range.
- **Its profile's.** binnacle runs as a dsh profile of its own, `binnacle`, in `~/.dsh/profiles/binnacle/`. On the first start, binnacle installs itself there. When the profile has another version of binnacle, binnacle says so, and installs its own version there. It changes nothing else in the profile, and no profile that it did not make.

Your settings, such as the model, go in the profile's `cordis.patch.yml`. `dsh --profile binnacle` starts the same profile, without the checks.

## What you can do

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
