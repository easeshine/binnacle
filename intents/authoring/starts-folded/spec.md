# Spec: a region that starts folded

- **Intent:** [Authoring](../intent.md), Stage 3, *Tool cards*. It serves outcome 2: a change of how one piece behaves "touches only that kind", and constraint 4: a change that an author cannot make in a small change is a gap.
- **Status:** agreed

## Problem

An author cannot make a region of the transcript start folded. The model `transcript`'s `folded` is the list of folded regions, and it starts empty. `transcript.fold` adds a region to it, or takes it out. So a Look that wants a card's details folded until the person opens them must read its region the other way round: folded while the region is not in `folded`. In a blind author trial of tool cards, each of three authors turned a region's meaning around this way. Each one's `folded` then said the opposite of what was drawn, to the next author who read it.

## Behaviour

1. An author's Look reads a region with `isFolded(region, { startsFolded: true })`, and the region draws folded until it is unfolded.
2. A person presses enter on a Marked event whose first `fold` region starts folded, and the region unfolds. Enter again folds it.
3. A person clicks a line marked `fold` with a region that starts folded, and the region unfolds. A click again folds it.
4. A region that the person unfolded stays unfolded as events come, and as the answer streams.
5. A Look of `transcript.card` reads the card's body with `isFolded(region, { startsFolded: true })`, and each card starts folded.
6. `folded` is an object of regions, empty at first: `true` for a region that is folded, `false` for one that is unfolded.
7. An author sets `folded[region] = false` to unfold a region that starts folded, and `folded[region] = true` to fold a region that starts unfolded.
8. An author deletes `folded[region]`, and the region draws as it starts.
9. A region read without `startsFolded` starts unfolded, as before. The transcript's raw Looks, the view's Looks and the default tool cards draw as before.
10. A region that the person folded or unfolded keeps that state when a Look reads it with another start.

## Journeys

The Journeys use one plugin in the profile, the folded-cards plugin. It lays a Look on `transcript.card` that calls the default card Look, with an `isFolded` that reads the body's region, `'<seq>/body'`, with `startsFolded: true`. It also binds `s` in the Place `transcript` to swap that start between folded and unfolded, and draws the cards again.

1. **Cards that start folded.** Start binnacle, and ask the agent to read `package.json`, then to list the folder's files. The answer streams, then each tool card draws its first line alone, ending with `(<n> lines)`. Press shift+tab: the transcript has the Focus, and the newest event is Marked. Press up until the `read` card is Marked, and press enter: its body draws under its first line. Press shift+tab, and ask the agent another question. While the answer streams, the `read` card stays unfolded. Each new card comes folded.
2. **A click on a card.** Click the first line of a folded card. The card is Marked, and its body draws. Click the same line again: the card folds, and its first line ends with `(<n> lines)` again. Click the line of a todo card: it is Marked, and nothing folds, as before.
3. **The start swapped in the session.** Ask the agent to read three files, one at a time. Three cards come folded. Press shift+tab. Mark the first card, and press enter: it unfolds. Mark the second, and press enter twice: it unfolds, then folds. Leave the third. Press `s`: the start is now unfolded. The first card stays unfolded, the second stays folded, and the third unfolds. Press `s` again: the third folds, and the first two stay as they are.
4. **The plugin turned off.** Take the plugin out of the profile, and restart binnacle. Ask the agent to read a file. The card draws with its body, as before. Press shift+tab, then up until the card is Marked, and press enter: it folds.

## Seams

- **The terminal**, through `@easeshine/binnacle/testing`'s mount: an author's Look and the session's events in, keys and clicks in. Out come the drawn rows.
- **The model `transcript`**, through `binnacle.modelOf('transcript')`: the test reads `folded` after a key or a click, and sets it.

## Decisions

1. **The read says how a region starts: `isFolded(region, { startsFolded: true })`.** A Look reads a region's state before it returns the line that names it, so the read is where the Look knows the start. A flag on the `Line` would come after the read, and the author would keep two places in step.
2. **`folded` becomes `Record<string, boolean>`.** A list of folded regions cannot say that a person unfolded a region that starts folded. A list of regions turned from their start would make `folded.includes(region)` say the opposite of what is drawn, as the trial's authors did by hand. An object says each state as it is drawn, and a region not in it draws as it starts.
3. **`transcript.fold` takes a region's start from the last draw.** A key or a click lands on what the person sees, and that is the last draw. A region read with `startsFolded: true` in the last draw starts folded. Each other region starts unfolded. The fold sets `folded[region]` to the opposite of the state drawn.
4. **Each read returns `folded[region]`, else its own `startsFolded`, else `false`.** Two reads of one region in one draw that give different starts each draw their own. The fold takes the region as folded at the start when any read of the last draw said so. A Look that reads a region in two places says the start at each.
5. **An event's own region starts unfolded.** `EventAt.folded` is read before the Look runs, so it cannot know a start that the Look says. A Look that starts its event folded reads `isFolded(String(event.seq), { startsFolded: true })` in its place, and marks its first line `{ text, fold: String(event.seq) }`.
6. **`CardAt.isFolded` takes the same second argument.** The tool cards pass the transcript's `isFolded` to `transcript.card`, so a card's Look starts a region folded as an event's Look does.
7. **The defaults do not change.** Every built-in region still starts unfolded. Whether a built-in card starts folded is a question for the Maintainer, and a change of its own.
8. **An entry stays in `folded` once it is set.** A region whose state returns to its start keeps its entry, as a person's choice. So the region keeps the state that the person gave it when a Look later reads it with another start.

## Edges

| Edge | Answer |
|---|---|
| The first region of an event, and its last | Behaviour 2: enter folds the first `fold` region, as before |
| No region read with `startsFolded` | Behaviour 9 |
| A region that is never drawn | Decision 3: it starts unfolded, and the fold has nothing to land on |
| An event that draws no line | Its entries in `folded` stay, as before |
| A long body, a narrow terminal | A folded body draws no line. An unfolded one draws as before. |
| Events come, and the answer streams | Behaviour 4 |
| Two reads of one region with different starts | Decision 4 |
| A Look laid over the card's, or taken away | Behaviour 10, Decision 8 |
| An empty `transcript.fold` | A region that starts folded stays folded, as the author asked |
| A stored session that is opened again | Its events come as events do, and each region starts as its Look says |
| A line of `transcript.head` marked `fold` | Its region starts unfolded: `HeadLook` has no `isFolded` (Out of scope) |
| After it: the Focus and the keys | A fold moves no Focus and no Mark, as before |
| Beside the Selection | A fold above the Selection clears it, as before |

## Out of scope

- A built-in region that starts folded: Decision 7.
- `isFolded` for `transcript.head` and `transcript.live`: neither is given one now.
- Folds that last after a restart: `folded` is the model's, and is not saved.

## Parts of the build

1. **An author makes a region start folded, and a person unfolds it.**
   - Behaviours 1 to 10. Before the build, at `origin/main`: `isFolded` takes one argument, and `folded` is an array. So the tests of Behaviours 1 to 8 and 10 fail at their first read of a drawn row or of `folded`. Behaviour 9 holds already: its test guards the defaults.
   - Code: `plugins/transcript/index.ts` (`TranscriptState`, `EventAt`, the draw and `transcript.fold`), and `plugins/tool-cards/index.ts` (`CardAt`).
   - Records: the `AGENTS.md` of `plugins/transcript/` and `plugins/tool-cards/`, `author/built-ins/transcript.md` and `author/built-ins/tool-cards.md`, and a changeset, a `minor`: `folded`'s type changes.

## Door

Two-way before 1.0, as `.agents/doors.md` says. After 1.0 it would be one-way: it changes what an author may import, the type of `folded` and the type of `isFolded`.
