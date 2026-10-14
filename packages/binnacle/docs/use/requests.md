# Requests

Rows `binnacle-requests`, `binnacle-requests-view`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/requests.md).

**An approval**, when a tool needs one:

- See the tool's name in a Title, with the subagent that asks, why it asks, and the call's arguments, at most 12 lines, with two Choices, `› Allow once` and `Reject`.
- Pick with enter, move the mark with up and down, which wrap, or pick with a click. Esc rejects, and does not interrupt the turn.

**A question**, when the agent asks:

- See the header and `1 of 3` as a Title, the question, its detail, and each option as a Choice with its description, then `Type an answer`, and `Done` where more than one can be chosen.
- Pick with enter or a click. In a question that allows more than one, a pick selects or unselects, and `Done` goes on.
- Open a Line with `Type an answer`. Enter writes what was typed, trimmed, and goes on as a pick does; an empty line is not written, and the Line stays. Esc goes back to the Choices, with the Line's text and the selected options kept. A question with no options opens the Line at once, and esc there dismisses the whole Request.
- Dismiss with esc on the Choices; the agent learns that the person dismissed it, and the turn is not interrupted.
- Answer several questions one after another; their answers go back together after the last.
- Review a plan: the plan is the detail, and the Choice that approves it is first.

**Both:**

- A Request that comes takes the Focus, and the composer comes back, with its draft, once no Request stands.
- Scroll a tall Request's question and detail, or an approval's arguments, with the wheel, or with page up and page down from the Choices or the Line. The Choices and the Line stay in view beneath it.
- A second Request waits until the first is answered, in the order they came. A Request that dsh withdraws goes. When the model's row unloads, an approval that still stands fails closed, and a question is dismissed.
