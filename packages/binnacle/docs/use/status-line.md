# Status line

Row `binnacle-status-line`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/status-line.md).

- See one line in the Chat: whether the agent is idle or running, and its model, such as `idle · gpt-6-luna`.
- On a stored session, see that it is read only, and its id.
- After a copy, see `copied` for two seconds, `sent to the terminal` when only the terminal was asked to copy, or `copy failed:` and why for five seconds ([Select and copy](copy.md)).
- When `palette.json` holds a mistake, see what is wrong first on the line, in `status.error`, until you correct it ([Colours](colours.md#a-mistake-in-the-file)).
- On a terminal narrower than the line, see it cut at its end with `…`. It never wraps to a second line.
