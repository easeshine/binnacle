# Changing binnacle

binnacle is a terminal app for dsh. Everything it draws and answers is a plugin. These pages say how an author changes it: start with [a plugin](plugin.md).

binnacle's own features are plugins too, and they import only what the package exports, as yours do. Each one is a default that you replace, whole or one piece at a time. The pages of the built-ins name what each one sets, so you need not read its source. Their source is in `src/` of this package:

| Row | Feature | Source |
|---|---|---|
| `binnacle` | the core: the terminal, Layouts, Places, the Focus, gestures, and the Kit | `src/index.ts`, `src/core/`, `src/kit/` |
| `binnacle-transcript` | the session's events | `src/plugins/transcript/index.ts` |
| `binnacle-transcript-view` | the transcript a person reads: prompts, answers and what the agent did | `src/plugins/transcript-view/index.ts` |
| `binnacle-notice` | the notice of a new version, above the transcript's first event | `src/plugins/notice/index.ts` |
| `binnacle-tool-cards` | each tool call and its result as one card, from the views dsh's tools give | `src/plugins/tool-cards/index.ts` |
| `binnacle-composer` | what a person types, before it is sent | `src/plugins/composer/index.ts` |
| `binnacle-commands` | the offer of dsh's commands while a person types `/` | `src/plugins/commands/index.ts` |
| `binnacle-status-line` | whether the agent runs, and on which model | `src/plugins/status-line/index.ts` |
| `binnacle-requests` | the approvals and the questions that stand, and the talk with dsh: a model that draws nothing | `src/plugins/requests/index.ts` |
| `binnacle-requests-view` | the Requests' default view: a person answers an approval or a question | `src/plugins/requests-view/index.ts` |

The components of the Kit, in `src/kit/`, are made from the author API, as your own can be.

## The layers

binnacle is built in layers, as a web app is built from a framework, a design system and its pages:

| Layer | Holds | On the web |
|---|---|---|
| the core | the terminal, Layouts, Places, the Focus and gestures | React and the DOM's layout |
| the theme | a colour for each Tone, the glyphs, a box's edge and spacing | Tailwind's tokens |
| the components: List, Title, Line and Tabs | what each one does, and the keys that do it | Radix's primitives |
| the Looks | how each piece of a component is drawn, with the theme | shadcn's styles |
| the features: the transcript, the composer and the rest | components and Parts put together, and the talk with dsh | an app's pages |

You change binnacle when you lay a piece over the defaults. The newest piece wins, and what you do not replace stays binnacle's.

## Each way to change something

What a plugin registers, such as a Part, a Layout, a theme layer, a Look, an action or a binding, goes when the plugin unloads. Of two registrations by one name, the newest wins. What binnacle's own rows register ranks beneath what you register, whichever loads first: a row is binnacle's own when its `name` is `@easeshine/binnacle` or begins with `@easeshine/binnacle/`. So your plugin wins over a built-in on every start, and its `beneath` is the built-in's.

| To change | The shortest way |
|---|---|
| where a Place is drawn | an edit of one node: `binnacle.edit('chat', …)` ([Edit one node](concepts/layouts.md#edit-one-node)) |
| a colour or a glyph, everywhere | a theme layer: `binnacle.theme(layer)` ([The theme](concepts/theme.md)) |
| how one piece of a component looks | a Look: `binnacle.look(name, make)` ([Looks](concepts/looks.md)) |
| what a Place draws | a Part: `binnacle.place(name, part)` ([Parts, Places and Screens](concepts/parts-places-screens.md)) |
| which keys run an action | a binding: `binnacle.bind(name, keys)` ([Bind an action](concepts/actions.md#bind-an-action)) |
| what an action does | an action by its id, which runs `beneath()` ([Run an action, and change what it does](concepts/actions.md#run-an-action-and-change-what-it-does)) |
| a new gesture that does what an action does | an enabled action that runs the other by its id: `binnacle.run(id)` ([Run an action, and change what it does](concepts/actions.md#run-an-action-and-change-what-it-does)) |
| the state that a feature draws | its Model: `binnacle.modelOf(name)` ([Models](concepts/models.md)) |
| the whole Screen | a Screen: `binnacle.show(screen)` ([Parts, Places and Screens](concepts/parts-places-screens.md)) |
| a whole feature | its row, turned off, and your plugin in its place ([Turn a built-in off](plugin.md#turn-a-built-in-off)) |
