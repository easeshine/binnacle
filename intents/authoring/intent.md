# Intent: an author changes any part of binnacle, alone, in a small change

- **Author:** Patrick Xin
- **Role:** Maintainer
- **Status:** Stages 1 to 3 are approved, while authoring is prototyped: every decision here may change. Stages 4 to 7 wait for the Maintainer's approval.
- **Date:** 2026-10-08, revised 2026-10-20

## Problem

binnacle's [product Intent](../binnacle/intent.md) promises that a person can ask an author agent to change anything binnacle draws or answers. binnacle has been built three times, and each time an author could rearrange or replace the whole screen, but not one piece of a feature. A feature drew everything, held its keys, and talked to dsh all in one place. Moving a question to the side, or changing how its choices are picked, meant rewriting the whole feature.

The combinations people may want are endless. We cannot build or check each one. What we can do is make each kind of change possible on its own, so that changes combine.

A prototype of Requests showed both halves: changes to where something goes and which keys do what were a few lines each, while changes to how a feature behaves copied most of the feature.

Nothing yet is shared between features. Each one draws its own list of choices and its own line to type in, so the next feature would drift from the last, and a person who changes how a list looks would have to change it once for each feature.

The pieces are there now, and they show a second problem. An author agent writes code well. Its hard part is all around the code:

- **To find what to change.** A person who is not a terminal person can point at a thing, but cannot name it. In the trials, authors read binnacle's core to learn which keys reach which action.
- **To know that a change works.** A change that names a Place that is not there does nothing, and says nothing. A binding of an editor key can say one thing and do another: binnacle reports the key as unbound, and the editor still takes it.
- **To keep the session safe.** A plugin that fails while it draws stops the draw of the whole screen. Text from a model stays plain only while each author remembers to make it plain.
- **To keep a change working.** After 1.0, each name that binnacle sets becomes a promise. With many small names, binnacle can never rename one. With a few large names, an author must replace a whole feature again.

## Proposed outcome

1. An author changes **where** something is drawn, **how** it looks, **which keys** do what, and **how** it behaves, including **when** it shows. Each kind of change is made the same way for the whole screen as for one small piece of it.
2. A change about one of these kinds touches only that kind. It keeps the rest of the feature as it is, and copies nothing else.
3. A feature's talk with dsh, and what keeps it safe, stay with binnacle. Changing how a feature looks or flows never means redoing them.
4. An author is the author agent, or a person who writes a plugin by hand. Both can do the same things.
5. A person picks an author agent for the session, as dsh's Creator mode does, and asks it for a change.
6. A change is saved in the person's profile. It applies to every later session and survives a restart, until the person undoes it.
7. Each built-in feature uses only what an author can use, so it is a default to replace, whole or one piece at a time. An author needs only what binnacle exports and its guide, never its source.
8. A person can still turn a whole feature off.
9. binnacle is built in layers, as a web app is built from a framework, a design system and its pages:
   - **the core** owns the terminal, where things go, the Focus and the gestures;
   - **the theme** names the colours by what they mean, the glyphs, the edges and the spacing. How a person and an author choose the colours is in the [colours Intent](../palette/intent.md);
   - **components**, such as a list, a line to type in, tabs and a title, each hold what they do and which keys do it, apart from how they look;
   - **their default looks** draw each component with the theme;
   - **features**, such as Requests, are made of components, and talk to dsh.
10. A change to a component's look or keys reaches every place the component is used, unless the author names one place. A change to the theme reaches everything that draws with it.

A change goes round one loop, from what a person asks to what they keep:

11. **A person points at a thing, and asks.** A person clicks a thing on the screen, or names it, and asks for a change. The author agent learns what drew it: its Place, its Look, its Tone, and the plugin that set each one.
12. **The author agent sees what binnacle sees.** It can ask binnacle what each Place holds now, which change set each thing, and why a change did not apply. It never reads binnacle's source for this.
13. **Most changes are not code.** A change that moves, recolours, rebinds or takes out a thing is a list of what it changes. binnacle checks each name in the list before the change loads. It refuses a name that is not there, and lists the names that are. An author writes code only for a new behaviour.
14. **A person sees a change before it goes on.** binnacle draws the screen before and after the change, in the person's own session. It also draws the change in the situations that each feature can be in, such as a narrow terminal, a light palette or a failed tool call. The person approves the change, and the author agent reads the same rows.
15. **A change keeps the person's words.** Each change keeps what the person asked, and the screen that they approved. A person lists their changes by their words, and undoes one by its words, such as "undo the orange errors".
16. **A change survives an upgrade.** After binnacle upgrades, it draws each change again in the same situations. A change that no longer draws what the person approved goes off, and binnacle names it. On the person's word, the author agent makes the change again from the person's words. If the new change draws what the person approved, it goes on, and binnacle says so. If not, the person sees it before and after, as in item 14.
17. **A broken change never stops the session.** A change that fails to load, to draw or to act is skipped and named. Everything else draws as before.
18. **Text from a model never styles itself,** whatever an author forgets to do.

## Affected users and systems

- **A person** who wants binnacle to look or act their own way.
- **A person who is not a terminal person:** they point at what they want changed, and approve what they see.
- **An author agent**, and **a person who writes a plugin**.
- **The agents that build binnacle:** each feature is tried by an author before it is done.
- **dsh:** its profiles hold a person's changes, as they hold any bundle.
- **binnacle's upgrades:** each one draws every change that a person keeps, and names each change that broke.

## Constraints

1. Authoring is built one feature at a time: build the feature, try it as an author, refine it, then the next.
2. A feature is done only when an author has tried it. That author knows only what any author gets from binnacle, and is from another family than the builder.
3. Each feature's Intent holds a few changes that a person might ask for, written by the Maintainer. A trial makes at least one change of each kind, and the author also makes up some of its own. At least one change takes something out entirely, such as no folding at all, as a person may not want what we did not think to ask about.
4. A change that an author cannot make in a small change is a gap, and it is fixed before the feature is done.
5. Every feature is made from the components and the theme. A feature that needs a piece they do not have adds that piece to them first, so the next feature can use it too.
6. There is no way to share a change before 1.0. A change is a dsh bundle, and it is shared the way bundles are.
7. The product's constraints hold: there is no promise of stability before the first stable release. After it, binnacle promises that a person's changes keep working. It does not promise that its names never change.
8. binnacle keeps its own layout and drawing, as they alone can say what drew each cell. A terminal library may go beneath them, but an author never imports one.
9. A trial checks item 16 before it is built. Each author gets only a change's words and its approved screen, from an earlier trial, after binnacle renames what the change named. If most changes do not come back, binnacle keeps a set of names that never change, in place of item 16.
10. A change that a person writes by hand has no words to make it from. When an upgrade breaks it, binnacle turns it off and names it, and nothing makes it again.

## Stages

Each stage ends in something the Maintainer can try under dsh.

1. **The first layers, and Requests made from them.** The theme, the components that Requests needs, and Requests built from those components. An author makes each of these changes small: space selects a choice where more than one can be chosen; tabs, or a click on a header, move between questions; a preview of every answer shows before they are sent; clicks do nothing; a Request draws as a dialog; a Request draws on the side.
2. **The features built so far.** The core, gestures, the transcript, the composer and the status line are each tried by an author, and refined. The product's next stage is built the same way after this.
3. **The transcript a person reads, tool cards and commands.** Each is built from the kit, with the pieces it lacks added to the kit first, and tried by an author.
   - **A readable transcript:** a person can tell what happens in the session, its prompts, answers and what the agent did, without reading dsh's data.
   - **Tool cards:** each tool call draws as a card, with its result. An author moves where a card folds, shows how long a call took or has run, and takes out folding or the times entirely.
   - **`/` commands:** typing `/` offers the commands, dsh's and binnacle's own. An author draws the offer as a dialog, adds a search line to it, and makes a command open a screen of its own, such as settings.
4. **The ground for the loop.** A change that fails to load, to draw or to act is skipped and named, and the session goes on. Text from a model never styles itself. binnacle knows what drew each cell. A change takes effect while the session runs, and the core stays up while its plugins reload. An author tries a change that fails, and a change that names a Place that is not there.
5. **Point and change.** A person picks an author agent with `/preset`, among dsh's presets and binnacle's. They point at a thing or name it, and ask for a change. They see it take effect, and can undo it. The author agent finds the authoring guide and the profile's files itself. It asks binnacle what is on the screen, and why a change did not apply. A change that moves, recolours, rebinds or takes out a thing is a list, which binnacle checks before it loads.
6. **Before and after.** Each feature names the situations it can be in. A person sees each change before and after, in their session and in those situations, and approves it before it goes on. A person can start with every change off.
7. **Keep and repair.** A person lists their changes by their words, and undoes one by its words. The trial of constraint 9 runs first. After an upgrade, binnacle turns off each change that no longer draws what the person approved, and names it. The author agent makes it again from the person's words.

## Specs

Stage 1:

- The kit: a theme, models, looks and components an author changes in one place.
- Requests made from the kit, so an author changes one piece of it.

Stage 2:

- The status line, made of segments an author edits one at a time.
- The composer, made of a draft, its actions and a Layout an author changes one at a time.
- The transcript, drawn by a Look for each type of event, with a model and actions an author changes one at a time.

Stage 3:

- The transcript a person reads, made of pieces an author changes one at a time.
- [A region that starts folded](starts-folded/spec.md), so an author folds a card's details until a person opens them: built.
- Tool cards: each call and its result as a card from dsh's views, with folds an author moves and times an author shows or takes out.
- `/` commands: a command line runs as a command, and typing `/` offers the commands in a List an author moves, draws and takes out.
- An author needs only what binnacle exports: built-ins on the API, the turn's start, a test kit, and each name written down.

Stages 4 to 7: none yet. The Lead writes each Spec when its Stage starts.

## Open questions

None.
