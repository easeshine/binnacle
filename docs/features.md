# Features

Each feature has a doc in `features/`: what a person can do, what an author can change, and how it is built so far. The code is the source of truth, and a feature's doc is the second source, beside it. A change to a feature edits its doc in the same commit.

Each feature is a plugin with a row of its own in the bundle's patch ([ADR 1](adr/0001-a-feature-is-a-cordis-plugin-on-the-binnacle-service.md)). A person turns a feature off by its row: `- id: <row>` and `disabled: true` in their profile's `cordis.patch.yml`. The core, row `binnacle`, is not a feature that can be turned off: it owns the terminal, and every feature needs it.

| Feature | Doc | Rows | Code |
|---|---|---|---|
| Core | [core](features/core.md) | `binnacle` | `packages/binnacle/src/` |
| Gestures | [gestures](features/gestures.md) | `binnacle` | `packages/binnacle/src/core/gestures.ts`, `packages/binnacle/src/core/input.ts`, `packages/binnacle/src/core/keyboard.ts`, `packages/binnacle/src/core/actions.ts` |
| Kit | [kit](features/kit.md) | `binnacle` | `packages/binnacle/src/core/model.ts`, `packages/binnacle/src/core/theme.ts`, `packages/binnacle/src/core/looks.ts`, `packages/binnacle/src/kit/`, `packages/binnacle/AUTHORING.md` |
| Transcript | [transcript](features/transcript.md) | `binnacle-transcript`, `binnacle-transcript-view` | `packages/binnacle/src/plugins/transcript/`, `packages/binnacle/src/plugins/transcript-view/` |
| Tool cards | [tool cards](features/tool-cards.md) | `binnacle-tool-cards` | `packages/binnacle/src/plugins/tool-cards/` |
| Composer | [composer](features/composer.md) | `binnacle-composer` | `packages/binnacle/src/plugins/composer/` |
| Commands | [commands](features/commands.md) | `binnacle-commands` | `packages/binnacle/src/plugins/commands/` |
| Status line | [status line](features/status-line.md) | `binnacle-status-line` | `packages/binnacle/src/plugins/status-line/` |
| Requests | [requests](features/requests.md) | `binnacle-requests`, `binnacle-requests-view` | `packages/binnacle/src/plugins/requests/`, `packages/binnacle/src/plugins/requests-view/` |
