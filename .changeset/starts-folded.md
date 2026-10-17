---
'@easeshine/binnacle': minor
---

A Look reads a region with `isFolded(region, { startsFolded: true })` to make it start folded, until the person or an author unfolds it. The model `transcript`'s `folded` is now an object of regions, `true` for a region that is folded and `false` for one that is unfolded, in place of the list of folded regions: set `folded[region] = true` where you pushed the region. `CardAt.isFolded` of the tool cards takes the same second argument. Every built-in region still starts unfolded.
