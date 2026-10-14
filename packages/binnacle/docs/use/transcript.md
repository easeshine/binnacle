# Transcript

Rows `binnacle-transcript`, `binnacle-transcript-view`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/transcript.md).

- Read the transcript, with the row `binnacle-transcript-view` on, as binnacle ships it:
  - a prompt as `› ` and its text, in the `accent` Tone, each line it wraps to under its text, or `› ` alone with no text;
  - an answer's reasoning in the `dim` Tone, then its text as markdown, wrapped at the width: headings, bold, italic, inline code, code blocks, lists, quotes, links and rules, a list item's and a quote's lines that wrap under its text. An answer with neither draws nothing;
  - a tool call as one line, `⏺ <tool>(<its arguments>)`, and its result as one line, `⎿ ` and its first line of text, or `✗ ` and its first line in the `error` Tone when it failed, each cut at the width. With no text, `⎿ (no text)` or `✗ failed`;
  - context the person did not type as one dim line that names its producer, such as `· context: agent-instructions`;
  - a command, a retry, a compaction and how a turn ended as one line each, such as `/compact`, `retrying (1/3): <why>` in the `warning` Tone, `· context compacted`, `· interrupted`, and `✗ <why>` in the `error` Tone when a turn failed;
  - nothing for every other event, which takes no row, and the Mark passes over it;
  - a blank line after a prompt, an answer and a tool result, but not after a context, a call or a notice, so a call and its result stand together.
- Watch the answer stream through the same pieces: its reasoning, its text as markdown, an unclosed code block as code to the end, a blank line, then each tool call with the arguments so far. The committed answer and its calls draw the same rows.
- Read a stored session the same way.
- Turn the row `binnacle-transcript-view` off, and read the session's events raw: each event's seq and type, then its data as JSON, and the answer that streams as one live block, each content block's deltas glued.
- Scroll the transcript with the wheel.
- Click the transcript while typing in the composer: the click folds or Marks what it lands on, and the keys stay in the composer. The Chat's transcript node has `clickFocus: false` ([Core](index.md)).
- Give the transcript the Focus with shift+tab: the newest event is Marked, in inverse video, or the event last clicked. A click there keeps the Focus in the transcript. Up and down move the Mark one event, and stop at the ends.
- Fold the Marked event with enter. With the view, an event of more than one line draws its first line, then `… <n> more lines` in the `muted` Tone. A prompt, an agent's answer, and an event of one line, do not fold: a click on them only Marks them. An author folds answers with a Look, as [the transcript's page for authors](../author/built-ins/transcript.md) shows. Raw, it folds to its header line, which ends with how many of its lines it hides: `▸ #<seq> <type> (<n> lines)`. A click on an event's first line folds or unfolds it, and Marks it. A click on another of its lines Marks it, and folds nothing, unless a Look marked that line.
- Keep the folds and the Mark as events come and the live block streams. The Mark is not drawn while the transcript has no Focus, and the same event is Marked when it comes back.
