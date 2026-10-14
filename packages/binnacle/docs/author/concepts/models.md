# Models

A Model is state, and the one way to change it.

```js
import { createModel } from '@easeshine/binnacle'

const counter = createModel({ count: 0 })
counter.set((state) => {
  state.count += 1
})
```

- `createModel(state)` makes a Model: `state`, `set(change)` and `watch(changed)`.
- `set(change)` calls `change` with the state, to change it in place.
- `watch(changed)` calls `changed` after each change, and returns what stops it. The watchers learn of a change in a microtask after it is made, once for the changes made together, and never while it is made. A watcher that changes the Model is told again after its own call.

A Part that lists its Models in `models` is drawn again after each of them changes, so it needs no code to redraw:

```js
ctx.binnacle.place('status.state', {
  models: [counter],
  lines: () => [`count: ${counter.state.count}`],
})
```

`binnacle.model(name, model)` names a Model, so that another plugin can read and change it. The newest Model by a name wins, and it goes when the plugin that named it unloads.

`binnacle.modelOf(name)` gives a Model that stands for the newest Model by that name, found each time it is read, set or watched. Find it in `apply`, whichever plugin names it first, and use it later:

- While no Model by that name is named, its `state` is `undefined`, `set` does nothing, and a watcher waits for one.
- A watcher is told when the newest Model changes, and when a newer Model by that name comes or goes.

## The clock

The core names the model `clock`. Its state's `now` is the time in epoch milliseconds. Name it in `models`, as any Model, to draw a time that changes:

```js
const clock = ctx.binnacle.modelOf('clock')
const started = Date.now()
ctx.binnacle.look('status.state', (beneath) => (value) => `${beneath(value)} ${Math.floor((clock.state.now - started) / 1000)}s`, {
  models: [clock],
})
```

- While `now` is read, the clock changes each second, and what names it is drawn again.
- Once a second passes with no read, nothing ticks. What is not drawn reads nothing, so it costs nothing.
- `set` on the clock does nothing.
- The type of its state is `ClockState`.

## The turn

The core names the model `turn`. Its state's `startedAt` is when the turn that runs started, in epoch milliseconds, or `undefined` while the agent does not run.

- It is the time of dsh's newest `turn/start` event. A turn that was queued starts while the agent runs, and sets it again.
- When the agent runs before its turn's `turn/start` comes, it is when the agent began to run.
- A plugin that loads while a turn runs reads that turn's start. On a stored session, and before the session opens, it is `undefined`.
- `set` on it does nothing. The type of its state is `TurnState`.

Read it with the clock to show how long the turn has run. This shows `running 1:05` in the status line ([The status line](../built-ins/status-line.md)), and draws what is beneath while no turn runs:

```js
const turn = ctx.binnacle.modelOf('turn')
const clock = ctx.binnacle.modelOf('clock')
ctx.binnacle.look(
  'status.state',
  (beneath) => (value) => {
    const { startedAt } = turn.state
    if (startedAt === undefined) return beneath(value)
    const seconds = Math.max(0, Math.floor((clock.state.now - startedAt) / 1000))
    return `${beneath(value)} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  },
  { models: [turn, clock] },
)
```
