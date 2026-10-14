# Requests

When the agent asks a question, or a tool asks for an approval, a Request stands until a person answers it. The row `binnacle-requests` is its model: it talks to dsh, keeps the queue, and keeps each Request's draft answer. It draws nothing. It provides `ctx.binnacleRequests`, and its types are `Requests` and `Request` from `binnacle`. The row `binnacle-requests-view` is its default view, which draws from it ([The default view](#the-default-view)).

```js
export const inject = ['binnacle', 'binnacleRequests']
export function apply(ctx) {
  const requests = ctx.binnacleRequests
  ctx.effect(() => requests.attach())
  ctx.binnacle.place('status.state', {
    models: [requests],
    lines: () => (requests.shown === undefined ? [] : [`${requests.standing} waiting for you`]),
  })
}
```

- `shown` is the Request on view, the first that stands, or `undefined`. `standing` is how many stand.
- `watch(changed)` is as a Model's: `changed` runs in a microtask after a Request comes or goes, or a draft changes.
- `attach()` says that your view draws the Requests, and returns what detaches it. The model answers dsh only while a view is attached. With none, a Request that comes goes on to dsh, which fails it closed. A Request that stands when the last view detaches fails closed, as when the model unloads: an approval is `unavailable`, and a question is dismissed.
- Each text in a Request is plain already. A Request that has gone, withdrawn, answered, dismissed or failed, ignores every call made on it after.

Both kinds have `agent`, the id of the agent that asks when it is not the Chat's own, such as a subagent. Only `submit()` and `dismiss()` answer dsh; every other call changes the draft and sends nothing.

An approval, `{ kind: 'approval' }`, has:

- `tool`, `why`, and `arguments`: the call's arguments as lines of JSON, at most 12, then a line that says how many more.
- `choices`, dsh's outcomes: `'allowed-once'` and `'rejected'`.
- `chosen` and `choose(outcome)`: the draft. `submit()` sends the outcome chosen, and with none chosen, sends nothing. `dismiss()` rejects it.

A question, `{ kind: 'question' }`, has:

- `questions`: each has `id`, `header`, `question`, `detail` (lines), `multiSelect`, `planReview`, and `choices`. The choices are its options, `{ kind: 'option', label, text, description }`, then `{ kind: 'other' }` for a typed answer, then `{ kind: 'done' }` where more than one can be chosen. A question with no options has none. In a plan review, the option that approves the plan is first.
- `label` is an option's identity, as the agent offered it, and `text` is the label made plain. Draw `text`, and give `label` to `toggle`.
- `index` and `go(index)`: the question on view.
- `typing` and `type(on)`: whether the person types an answer to the question on view. A question with no options is typed at once.
- `drafts`: each question's answer so far, `{ selected, custom }`, by its index.
- `toggle(label)`: in the question on view, selects the option, or unselects it. Where only one can be chosen, it is the only answer.
- `write(text)`: the typed answer to the question on view, trimmed. An empty one takes it back. Where only one can be chosen, it is the only answer.
- `submit()` sends every question's draft, answered or not. `dismiss()` dismisses the whole Request, and the agent learns it.

The model does not decide when a Request is sent: the view does. To draw the Requests your own way, change the default view, or turn off the row `binnacle-requests-view` and attach a view of your own. Turn off `binnacle-requests` and the view goes with it, as it waits for the model.

## The default view

The row `binnacle-requests-view` draws the Request on view in the Layout `request`, made from the Kit:

```js
{
  column: [
    { place: 'request.title', size: 'content' },
    { place: 'request.body', size: 'fill' },
    { place: 'request.choices', size: 'fill' },
    { place: 'request.line', size: 'content' },
  ],
  border: ['bottom'],
}
```

- `request.title` is a Title: an approval's tool, with the agent that asks when it is not the Chat's; a question's header, with `1 of 3` among several.
- `request.body` is a Part: a question and its detail, or an approval's reason and its arguments. The body and the Choices fill, so that each takes what its lines need while there is room, and a tall one scrolls with both in view, the Line beneath them. The wheel scrolls it, and so do page up and page down from `request.choices` and `request.line`, by the actions `requests.pageUp` and `requests.pageDown`. The List's own page keys are not bound in `request.choices`.
- `request.choices` is a List: `Allow once` and `Reject`, or a question's options, then `Type an answer`, then `Done` where more than one can be chosen. Enter or a click picks. Esc there runs `requests.dismiss`, which rejects an approval or dismisses a question. The action `requests.keep` takes ctrl+c, ctrl+z and shift+tab there and does nothing, so the core does not clear, quit, suspend or move the Focus while a Request stands.
- `request.line` is a Line, shown while the person types an answer. Enter writes what was typed and goes on, and esc goes back to the Choices. Its text is kept by `keyOf` the Request and its question.
- A Request that comes takes the Focus. The composer comes back, with its draft, once no Request stands.

Each way that the view sends, a pick, `Done` or the last typed answer, runs the action `requests.send`. Its default sends the Request on view. Set it to change what sending does, and run `beneath` to send, as [Run an action, and change what it does](../concepts/actions.md#run-an-action-and-change-what-it-does) shows. A plugin that sends later keeps its Request: it calls that Request's `submit()`, or runs `beneath` only while that Request is still on view, so that it never sends another.

The view's entry, `@easeshine/binnacle/plugins/requests-view`, exports what it is built from:

- `REQUEST_LAYOUT`, the Layout above, frozen. Build on it to add a Place, such as tabs above the title:

  ```js
  import { REQUEST_LAYOUT } from '@easeshine/binnacle/plugins/requests-view'

  ctx.binnacle.layout('request', { ...REQUEST_LAYOUT, column: [{ place: 'request.tabs' }, ...REQUEST_LAYOUT.column] })
  ```

- `titleOf(request)`: the Title's text.
- `itemsOf(request)`: the Choices as List items, none while the person types. An option's item is its `text`, not its `label`.
- `pick(binnacle, request, index)`: what a pick of the Choice at that index does.
- `advance(binnacle, request)`: after a question is answered, the next question, or after the last, `requests.send`.
- `keyOf(request)`: a key for each Request and each of its questions, for a List's `key` or a Line's.
