# Status line

Row `binnacle-status-line`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/status-line.md).

- See one line in the Chat: whether the agent is idle or running, and its model, such as `idle · gpt-6-luna`.
- On a stored session, see that it is read only, and its id.
- After a copy, see `copied` for two seconds, `sent to the terminal` when only the terminal was asked to copy, or `copy failed:` and why for five seconds ([Select and copy](copy.md)).
- On a terminal narrower than the line, see it cut at its end with `…`. It never wraps to a second line.
