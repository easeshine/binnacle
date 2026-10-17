# A Look says how a region starts, and `folded` holds only the choices made

**Status:** accepted, 2026-10-16

A Look says how a region of the transcript starts, folded or unfolded, where it reads the region. The model `transcript`'s `folded` holds only the state that a person or an author gave a region. A region with no entry draws as its Look says it starts.

## Why

In a blind trial of tool cards, three authors of three model families each wanted a card's details folded until the person opened them. binnacle's `folded` was the list of folded regions, and it started empty, so each region started unfolded. Each author turned a region's meaning around by hand: folded while it was not in the list. The list then said the opposite of what was drawn, to the next author who read it.

So the start must be the author's to say, and the model must say what the person sees.

## The decisions

- **The start is said where the region is read.** A Look reads a region's state before it returns the line that names it, so the read is where the Look knows the start. A start said in one place cannot drift from a second place.
- **`folded` says each state as it is drawn.** An entry is `true` for folded and `false` for unfolded, whatever the region's start. A reader never needs the start to know what an entry means.
- **A fold toggles what the person saw.** A key or a click lands on the last draw, so the fold takes the region's start from it, not from how the Looks would read it now.
- **A choice outlives a change of start.** An entry stays once it is set. A person who opened a card keeps it open when a Look later reads it with another start.
- **Every built-in region still starts unfolded.** The change gives authors the start. Whether a built-in starts folded is a decision of its own.

## Considered options

- **A flag on the line that names the region.** The Look returns the line after it reads the region, so the author would say the start in two places and keep them in step.
- **Keep `folded` as a list of folded regions.** It cannot say that a person unfolded a region that starts folded.
- **A list of the regions turned from their start.** Whether a region is in it would no longer say whether it is folded, as with the trial's workaround.
- **Toggle from the start that the Looks read now.** If a start changed since the last draw, the fold would toggle a state that the person never saw.

## Consequences

- `folded` changed from a list to an object, and `isFolded` takes a start. This broke what an author may import.
- An author who reads a region in two places says its start at each.
- An event's own region starts unfolded, as the transcript reads it before the event's Look runs. A Look that starts its event folded reads the event's region itself.
- A region's start is not saved: after a restart, each region starts as its Look says.
