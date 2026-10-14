# The transcript

The row `binnacle-transcript` places its Part in the Place `transcript`, which the Chat draws. On its own, it draws each event of the session raw: its header, `▾ #<seq> <type>`, then its data as JSON, and the answer that streams as one live block. The row `binnacle-transcript-view` lays the transcript a person reads over it, as [The transcript's view](#the-transcripts-view) says. Turn the view off to see each event raw.

- Its state is the model `transcript`, of the type `TranscriptState` from `@easeshine/binnacle/plugins/transcript`:
  - `events`: the committed events, in order.
  - `live`: the blocks of the answer that streams, in the answer's order, or `undefined` while none streams. Each block, of the type `LiveBlock`, has a `kind` (`text`, `reasoning` or `tool-call`), its `text`, and a tool call's `name` once dsh gives it. The blocks end when the answer commits.
  - `folded`: the folded regions, as strings, empty at first. An event's own region is its seq, such as `'12'`, and a part of it is a region such as `'12/body'`, which a Look names on a line it draws. An event that draws no line keeps its regions folded.
  - `marked`: the seq of the Marked event, or `undefined`.
- The transcript sets `events` and `live`. Read them. If you set them, the transcript replaces them at the next event or frame.
- Set `folded` and `marked` to change what is drawn. This plugin folds each tool result when it comes:

  ```js
  const transcript = ctx.binnacle.modelOf('transcript')
  ctx.effect(() =>
    transcript.watch(() => {
      const { events, folded } = transcript.state
      const fresh = events.filter((event) => event.type === 'tool/result' && !folded.includes(String(event.seq)))
      if (fresh.length > 0) transcript.set((state) => state.folded.push(...fresh.map((event) => String(event.seq))))
    }),
  )
  ```

- Up, down and enter run the actions `transcript.up`, `transcript.down` and `transcript.fold`. They act in the Place `transcript`, with the keys of the Gesture Table's `tui.select.up`, `tui.select.down` and `tui.select.confirm`. A click in the transcript runs `transcript.click`. Bind them as any action, so `j` and `k` move the Mark:

  ```js
  ctx.binnacle.bind('transcript.down', ['j'])
  ctx.binnacle.bind('transcript.up', ['k'])
  ```

- Set one of them by its id to change what it does, and run `beneath()` to keep the default.
- Every fold goes through `transcript.fold`. Given no cell, at a key, it folds the Marked event's first region marked `fold` on a line it draws, else the event's own region. Given a cell, it folds the region of the line there when the line is marked `fold`, the event's own region when the line is the event's first and a plain string, and nothing else. `transcript.click` Marks the event clicked, then runs the action of the line clicked when it is marked `run`, else `transcript.fold`, each with the cell. So an empty `transcript.fold` stops every fold, by a key and by a click:

  ```js
  ctx.binnacle.action('transcript.fold', { run: () => {} })
  ```

- Each event draws through the Look `transcript.event.<type>`, such as `transcript.event.tool/call`, and beneath it `transcript.event`, which draws every type. Its type is `EventLook` from `@easeshine/binnacle/plugins/transcript`: `(event, { folded, isFolded, width }) => Line[]`. It is given the event, whether the event's own region is folded, `isFolded(region)` for any region, and the transcript's width, and returns the event's lines. The transcript's own default draws the header, the JSON and a blank line, or the header with its count while folded. Make an event's text plain with `toPlainText` before you draw it, and cut a line at `width` to keep it to one row: the core wraps a wider one. This draws each tool call as one line:

  ```js
  import { toPlainText, truncateToWidth } from '@easeshine/binnacle'
  ctx.binnacle.look('transcript.event.tool/call', () => (event, { width }) => {
    const { name, arguments: args } = event.data
    return [truncateToWidth(toPlainText(`⏺ ${name}(${args})`), width)]
  })
  ```

- A line is a `Line` from `@easeshine/binnacle/plugins/transcript`: a string, or `{ text, fold }` or `{ text, run }`, each with an optional `from`. The transcript draws its `text`. A click on a line with `fold` folds that region, and a click on a line with `run` runs that action, given the cell clicked. A line with both runs its action. Either acts only at the column `from` of its text and after it, counted in cells without its styles, 0 by default: a click before it only Marks its event. Enter folds the first `fold` region whatever its `from`. A click on an event's first line, when it is a string, folds the event's own region, so a Look that returns strings folds as before. A click on any other string Marks its event, and folds nothing. A Look that changes the lines of the Look beneath it reads a line's text with `typeof line === 'string' ? line : line.text`. This draws a `[-]` that folds the body of each tool call, and a `[x]` that runs an action of the author's, given the cell clicked:

  ```js
  ctx.binnacle.action('my.copy', { run: (at) => {} })
  ctx.binnacle.look('transcript.event.tool/call', () => (event, { isFolded, width }) => {
    const body = `${event.seq}/body`
    const head = [`⏺ ${toPlainText(event.data.name)}`, { text: isFolded(body) ? '[+]' : '[-]', fold: body }, { text: '[x]', run: 'my.copy' }]
    return isFolded(body) ? head : [...head, truncateToWidth(toPlainText(event.data.arguments), width)]
  })
  ```

  This folds each tool call's body from the `[-]` at the end of its first line, and a click on its name only Marks it:

  ```js
  import { toPlainText, truncateToWidth, visibleWidth } from '@easeshine/binnacle'
  ctx.binnacle.look('transcript.event.tool/call', () => (event, { isFolded, width }) => {
    const body = `${event.seq}/body`
    const name = `⏺ ${toPlainText(event.data.name)} `
    const head = { text: name + (isFolded(body) ? '[+]' : '[-]'), fold: body, from: visibleWidth(name) }
    return isFolded(body) ? [head] : [head, truncateToWidth(toPlainText(event.data.arguments), width)]
  })
  ```

- Read an event with the readers from `@easeshine/binnacle/plugins/transcript`, so that a Look need not know dsh's shapes. Each is given an event of any type, and gives `''` or `undefined` for an event of another type or of a shape it cannot read:
  - `textOf(event)`: the text of a person's message, an answer's or a tool result's, its text blocks joined, or `''`.
  - `reasoningOf(event)`: an answer's reasoning, its reasoning blocks joined, or `''`.
  - `callOf(event)`: a tool call's `{ name, args }`, its arguments as the model wrote them, or `''` with none. It is `undefined` for another event, or a call with no name.
  - `producerOf(event)`: the producer of context that the person did not type, such as `agent-instructions`, or `'unknown'` when it names none. It is `undefined` for a prompt or another event.
  - `noticeOf(event)`: what a command, a retry, a compaction or a turn's end says, as a `Notice`: `{ kind, text, severity }`. The `kind` is `command`, `retry`, `compaction` or `turn`, and the `severity` is `info`, `warning` or `error`. It is `undefined` for another event, such as a turn that completed.
  - `isPrompt(event)`: whether the event is a prompt the person typed, not context that dsh added, such as a file's change.
  - `failed(event)`: whether the event is a tool result that failed.
  - `withoutReasoning(event)`: the event with its reasoning taken out, from the answer's message and from its stream, or the event as it is.

  This draws the person's prompts as `> <text>` in the accent Tone, and dsh's context as before:

  ```js
  import { toPlainText } from '@easeshine/binnacle'
  import { isPrompt, textOf } from '@easeshine/binnacle/plugins/transcript'
  ctx.binnacle.look('transcript.event.user/message', (beneath) => (event, at) =>
    isPrompt(event) ? [ctx.binnacle.paint('accent', toPlainText(`> ${textOf(event)}`)), ''] : beneath(event, at),
  )
  ```

  With the row `binnacle-transcript-view` off, this hides the reasoning of each committed answer. With the view on, set `transcript.reasoning`, as [The transcript's view](#the-transcripts-view) says:

  ```js
  import { withoutReasoning } from '@easeshine/binnacle/plugins/transcript'
  ctx.binnacle.look('transcript.event.assistant/message', (beneath) => (event, at) => beneath(withoutReasoning(event), at))
  ```

- The transcript Marks an event's first line in inverse video, and a click lands on the line it was drawn on. Its Look draws what a folded event shows.
- An event whose Look returns no line takes no row, and the Mark passes over it: up and down move between the events that draw. A `marked` whose event draws no line, or that is no event, is drawn on the next event that draws, else the one before it, else nowhere. Drawing never changes `marked`, so the Mark comes back to its event when it draws again. This draws no system message:

  ```js
  ctx.binnacle.look('transcript.event.system/message', () => () => [])
  ```

- The answer that streams draws through the Look `transcript.live`, of the type `LiveLook`: `(blocks, width) => Line[]`, given the blocks, each a `LiveBlock`, and the width. A click on its line marked `run` runs that action. The live block is no event, so it is never Marked. With the view off, this leaves out the reasoning of the answer that streams, as `withoutReasoning` does for the committed answer:

  ```js
  ctx.binnacle.look('transcript.live', (beneath) => (blocks, width) => beneath(blocks.filter((block) => block.kind !== 'reasoning'), width))
  ```

- Lines above the first event draw through the Look `transcript.head`, of the type `HeadLook`: `(width) => Line[]`, none by default. They scroll with the events, and are never Marked. A click on a line marked `run` runs that action. The row `binnacle-notice` draws the notice of a new version here. This adds a line of its own after what is beneath:

  ```js
  ctx.binnacle.look('transcript.head', (beneath) => (width) => [...beneath(width), 'Welcome back', ''])
  ```

- The transcript calls each Look at each draw, so a Look follows the theme, and the models it names in `binnacle.look`'s `{ models }`.

## The transcript's view

The row `binnacle-transcript-view` draws the transcript a person reads. A prompt draws as `› ` and its text, in the `accent` Tone. An answer draws its reasoning in the `dim` Tone, then its text as markdown, wrapped at the width, with `markdown`. A tool call draws as one line, `⏺ <tool>(<its arguments>)`, and its result as one line, `⎿ ` and its first line of text, or `✗ ` and its first line in the `error` Tone when it failed. Context that dsh added draws as one line in the `dim` Tone, such as `· context: agent-instructions`. A command, a retry, a compaction and how a turn ended draw one line each, such as `/compact`, `retrying (1/3): <why>` in the `warning` Tone, or `✗ <why>` in the `error` Tone. Every other event draws nothing, and takes no row.

- It sets the Looks `transcript.event.<type>` of the types it draws, `transcript.event` beneath them to draw nothing, and `transcript.live`.
- Each piece it draws is a Look of its own, given plain data and `{ width, time }`, never dsh's shapes, and returns lines. `time` is the event's, in epoch milliseconds, and `undefined` for a piece of the answer that streams, which is no event yet. The types are from `@easeshine/binnacle/plugins/transcript-view`:

  | Look | Draws | Given | Type |
  |---|---|---|---|
  | `transcript.prompt` | a prompt the person typed | its text | `TextLook` |
  | `transcript.answer` | an answer's text | its text | `TextLook` |
  | `transcript.reasoning` | an answer's reasoning | its text | `TextLook` |
  | `transcript.call` | a tool call | `{ name, args }` | `CallLook` |
  | `transcript.result` | a tool result | `{ text, failed }` | `ResultLook` |
  | `transcript.context` | context that dsh added | `{ producer }` | `ContextLook` |
  | `transcript.notice` | a command, a retry, a compaction or a turn's end | `{ kind, text, severity }` | `NoticeLook` |

- A piece is given its text as it came, Untrusted Text: make it plain before you draw it. A Look that returns no line takes the piece out. An event left with no line takes no row, its blank line included. This draws each prompt with a `> ` before each of its lines, and takes the reasoning out:

  ```js
  import { wrap } from '@easeshine/binnacle'
  ctx.binnacle.look('transcript.prompt', () => (text, { width }) =>
    wrap(text, width, { first: '> ', rest: '> ', plain: true }).map((line) => ctx.binnacle.paint('accent', line)),
  )
  ctx.binnacle.look('transcript.reasoning', () => () => [])
  ```

- `transcript.reasoning` alone hides the reasoning, of each committed answer and of the answer that streams. With the view on, `transcript.live` and `withoutReasoning` are not needed for it.
- This draws each prompt after the time it was sent, with no change to its type's Look:

  ```js
  ctx.binnacle.look('transcript.prompt', (beneath) => (text, at) => {
    const sent = at.time === undefined ? '' : new Date(at.time).toTimeString().slice(0, 5)
    return [ctx.binnacle.paint('muted', `── ${sent}`), ...beneath(text, at)]
  })
  ```

- The default `transcript.answer` draws the text with `markdown`, as [Text](../concepts/parts-places-screens.md#text) says, so a markdown Look, such as `markdown.code`, changes the answers. This draws each answer indented by two cells, with a `●` before its first line:

  ```js
  import { markdown } from '@easeshine/binnacle'
  ctx.binnacle.look('transcript.answer', () => (text, { width }) =>
    markdown(ctx.binnacle, text, width - 2).map((line, at) => (at === 0 ? '● ' : '  ') + line),
  )
  ```

- The type's Look joins its pieces' lines. A folded event with more than one line draws its first line, then `… <n> more lines` in the `muted` Tone. A prompt and an answer do not fold, as a person reads them whole: their first line is `{ text }`, so a click on it only Marks. Then a prompt, an answer and a tool result end with a blank line. A context, a call and a notice do not, so a call and its result stand together. Set `transcript.event.<type>` to space or fold an event your own way. This folds each answer again at a click on its first line:

  ```js
  ctx.binnacle.look('transcript.event.assistant/message', (beneath) => (event, at) => {
    const [first = '', ...rest] = beneath(event, at)
    const text = typeof first === 'string' ? first : first.text
    const line = { text, fold: String(event.seq) }
    // The default ends with a blank line, which the count leaves out.
    return at.folded ? [line, `… ${rest.length - 1} more lines`, ''] : [line, ...rest]
  })
  ```
- The answer that streams draws through the same pieces: its reasoning, then its text, then a blank line, then each tool call with its arguments so far.
