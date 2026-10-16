# Notice: how it is built

Row `binnacle-notice`. For a person: `docs/use/notice.md`. For an author: `docs/author/built-ins/notice.md`.

- **As pi tells of a new version**: in the transcript, when a session starts, so it is read where a person looks and scrolls away. It adds its lines to `transcript.head` beneath an author's, and draws them through `notice.update`, read at each draw, so they follow the theme.
- **Its own Tones**, `notice.warning`, `notice.muted` and `notice.accent`, are each `{ like: <the general Tone> }` in a theme layer that the row adds at load. `Update Available` is `{ like: 'notice.warning', bold: true }`, read at each paint, so it follows a layer of `notice.warning`.
- **Once for each version**, unlike pi, which tells at each start: the version told is kept in `told`, `$DSH_HOME/binnacle/notice.json` by default, as dsh finds its home. It is written once the Look is set. A file that cannot be written tells again at the next start.
- **It asks npm once at load**, in the background, for the package's `latest`, with a 10 second bound, and stops when the row unloads. Offline, slow, or a reply with no version, and it tells nothing. `latest: ''` asks nothing, as the test kit sets.
- **Its own name, version and repository** are read from the first `package.json` up from its file, so the name stays written once, in `src/core/name.ts` and the manifest. The changelog is the repository's releases, which the release workflow makes.
- **Versions are ordered as semver orders them** (`newer`), by a few lines of its own: a built-in imports only binnacle's entry, the built-ins, cordis, dsh and node, so not `semver`.
