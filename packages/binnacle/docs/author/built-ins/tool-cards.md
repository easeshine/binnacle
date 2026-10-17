# Tool cards

The row `binnacle-tool-cards` draws each tool call and its result as one card, where the call is: `⏺ ` and the tool's title, its body, then a blank line. The `⏺` is in the Tone `transcript.card.accent` while the call runs, `transcript.card.success` when it is done, and `transcript.card.error` when it failed, and a card that is done ends its first line with how long the call took, such as ` · 1.2s`, in `transcript.card.muted`. The body comes from dsh's views of the call and its result, which each tool gives with its `presentCall` and `presentResult`: a shell command's last 12 lines, a diff's counts for each file, a search's matches, or a read's lines. Turn the row off, and a call and its result draw as two lines again, as [The transcript's view](transcript.md#the-transcripts-view) says.

- The card draws in Tones of its own and in pi's, so a theme layer colours one piece of a card alone. Each of its own Tones is like the general Tone of its name until a layer changes it, so a change to `error` reaches `transcript.card.error`:

  | Tone | Draws | Like |
  |---|---|---|
  | `transcript.card.accent` | the `⏺` of a call that runs, and a todo in progress | `accent` |
  | `transcript.card.success` | the `⏺` of a call that succeeded | `success` |
  | `transcript.card.error` | the `⏺` of a call that failed, and a shell's `exit <code>` or `signal <name>` | `error` |
  | `transcript.card.warning` | a search's ` (truncated)` | `warning` |
  | `transcript.card.muted` | `… <n> earlier lines`, the time, the count of a folded card, and a completed todo | `muted` |
  | `toolTitle` | the title's text, after the `⏺` | `text` |
  | `toolOutput` | each line of a shell's output | `text` |
  | `toolDiffAdded`, `toolDiffRemoved` | a diff's `+<added>` and `-<removed>` | `success`, `error` |

  This draws a shell's exit status in orange, and leaves every other error in `error`:

  ```js
  ctx.binnacle.theme({ colors: { 'transcript.card.error': 'orange' } })
  ```

- It sets `transcript.event.tool/call` to draw the card, and `transcript.event.tool/result` to draw nothing when its call is in the session, and `beneath` when it is not.
- A card draws through the Look `transcript.card`, of the type `CardLook` from `@easeshine/binnacle/plugins/tool-cards`: `(card, { width, isFolded }) => Line[]`. It is given a `Card`:
  - `seq`: the seq of the call's event.
  - `name`: the tool's name.
  - `args`: the call's arguments, parsed, or the raw string when they are not JSON.
  - `call`: dsh's view of the call, a `ToolCallView`, or `undefined` when the tool gives none. Its `card` is `terminal`, `diff` or `generic`.
  - `result`: `{ view, text, failed }` once the result came, else `undefined`. `failed` is true when dsh's `isError` is, or when `view` is `terminal` with an `exitCode` other than 0, or with a `signal`. `view` is dsh's view of the result, a `ToolResultView`, or `undefined`. Its `card` is `terminal`, `diff`, `search`, `read`, `web` or `generic`.
  - `startedAt` and `endedAt`: the times of the call's and the result's events, in epoch milliseconds. `endedAt` is `undefined` while the call runs.

  Text in `call` and `result` is Untrusted Text: make it plain before you draw it. This draws each card in a box, with `frame`:

  ```js
  import { frame, toPlainText } from '@easeshine/binnacle'
  ctx.binnacle.look('transcript.card', () => (card, { width }) =>
    frame(ctx.binnacle, [toPlainText(card.result?.text ?? 'running')], width, { title: toPlainText(card.call?.title ?? card.name) }),
  )
  ```

- The default card draws each of its pieces through a Look of its own:

  | Look | Draws | Given | Type |
  |---|---|---|---|
  | `transcript.card.title` | the first line's text, without the time | the card, and the width left beside the time | `CardTitleLook` |
  | `transcript.card.mark` | the painted `⏺`, which the default title draws before the title | the card | `CardMarkLook` |
  | `transcript.card.time` | how long the call took, or `''` for none | the card | `CardTimeLook` |
  | `transcript.card.most` | how many lines a terminal, web, generic or no-view body shows, 12 by default | the card | `CardMostLook` |
  | `transcript.tool.<name>` | one tool's body, such as `transcript.tool.grep` | the card, and the body's width | `CardBodyLook` |
  | `transcript.card.<kind>` | one card kind's body, beneath `transcript.tool.<name>`, such as `transcript.card.terminal` | the card, and the body's width | `CardBodyLook` |

  The kind is the result view's `card` once the result came, else the call view's, else `generic`. A body's Look returns its lines without the `⎿` prefix, which the card adds. This example changes three things:

  - A shell command's card shows its last 3 lines, after `… <n> earlier lines`.
  - A running call's dot is hollow.
  - No card shows a time.

  ```js
  ctx.binnacle.look('transcript.card.most', (beneath) => (card) => (card.result?.view?.card === 'terminal' ? 3 : beneath(card)))
  ctx.binnacle.look('transcript.card.mark', (beneath) => (card) => (card.result === undefined ? '○' : beneath(card)))
  ctx.binnacle.look('transcript.card.time', () => () => '')
  ```

- The default time reads no clock, so it shows nothing while the call runs. Name the model `clock` in the Look's `models` to count a running time, as [The clock](../concepts/models.md#the-clock) says:

  ```js
  const clock = ctx.binnacle.modelOf('clock')
  ctx.binnacle.look('transcript.card.time', (beneath) => (card) =>
    card.endedAt === undefined ? `${Math.floor((clock.state.now - card.startedAt) / 1000)}s` : beneath(card), { models: [clock] })
  ```

- The default card's first line is `{ text, fold: '<seq>/body' }`. So enter on the Marked card, or a click on its first line, folds its body. The folded card draws its first line alone, ending with `(1 line)` or `(<n> lines)`. A card with no body has nothing to fold: its first line is `{ text }`, a Line that folds nothing. Set `transcript.card` to put the fold on another line, as [The transcript](transcript.md) says of a `Line`.
- Each card starts unfolded. The `isFolded` that `transcript.card` is given reads a region as the transcript's does, `isFolded(region, { startsFolded })`. So a Look that gives the default an `isFolded` that reads the body with `startsFolded: true` starts each card folded, and enter or a click unfolds it:

  ```js
  ctx.binnacle.look('transcript.card', (beneath) => (card, at) =>
    beneath(card, { ...at, isFolded: (region) => at.isFolded(region, { startsFolded: region === `${card.seq}/body` }) }),
  )
  ```

