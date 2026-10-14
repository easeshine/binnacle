# The status line

The row `binnacle-status-line` sets the Layout `status`, which the Chat draws. It is a separated row of segments, each a Place:

```js
{
  row: [{ place: 'status.state' }, { place: 'status.model' }],
  separator: true,
}
```

- `status.state` is the agent's status, `idle` or `running`, or `read only` on a stored session.
- `status.model` is the agent's model, or the stored session's id.
- Each segment draws through the Look by its Place's name, `(value) => line`. It is given its value, plain already, and returns one line. Its default draws the value in `text`. Set one, and only that segment changes:

  ```js
  ctx.binnacle.look('status.state', (beneath) => (value) => (value === 'running' ? ctx.binnacle.paint('accent', value) : beneath(value)))
  ```

  A segment's Look that reads a model names it, and draws again when it changes. This one says `waiting for you` while a Request stands, and draws what is beneath while none does:

  ```js
  const requests = ctx.binnacleRequests
  ctx.binnacle.look('status.state', (beneath) => (value) => (requests.shown === undefined ? beneath(value) : 'waiting for you'), {
    models: [requests],
  })
  ```

- Add a segment with an edit of the Layout `status`, and place a Part in it. It is joined by the `divider` glyph:

  ```js
  ctx.binnacle.edit('status', { insert: { place: 'cwd' }, after: 'status.model' })
  ctx.binnacle.place('cwd', { lines: () => [process.cwd()] })
  ```

- Place a Part in a segment to draw it your own way. A segment draws only its Part's first line.
- Show how long the turn has run after the state with a Look of `status.state` that reads the models `turn` and `clock`, as [The turn](../concepts/models.md#the-turn) shows.
- `STATUS_LAYOUT`, the Layout above, frozen, is exported from `@easeshine/binnacle/plugins/status-line`, with the type `SegmentLook`. Build on it to set the Layout `status` again.
