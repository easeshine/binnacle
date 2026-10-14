# The test kit: how it is built

Exported as `@easeshine/binnacle/testing`. For an author: `docs/author/plugin.md`, its part on testing.

- **`@easeshine/binnacle/testing` is the harness of binnacle's own tests** (`index.ts#mount`). It mounts the core on an emulated terminal, `@xterm/headless`, with a fake process, streams and clock, and a fake agent of dsh's that records what it is sent. It loads the built-ins as rows of a Cordis loader named `@easeshine/binnacle/plugins/<name>`, so they rank as a profile ranks them, and an author's plugins as rows of their own after them. It holds the core's terminal and clock, so one mount is open at a time. The core's own tests use the harness beneath it, `core.ts#mountCore`, which starts the core before dsh is ready.
