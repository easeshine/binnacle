# The notice

The row `binnacle-notice` asks npm for binnacle's newest version when binnacle starts. When it is newer than the version that runs, and was not told before, the notice draws it through the transcript's Look `transcript.head`, above the first event, as [the transcript's page](transcript.md) says.

- The notice draws through the Look `notice.update`, of the type `UpdateLook` from `@easeshine/binnacle/plugins/notice`: `(update, width) => Line[]`. It is given an `Update`, `{ version, current, command, changelog }`, and the transcript's width, and returns lines as the transcript's Looks do. Its default draws a rule in `notice.warning`, `Update Available` in bold `notice.warning`, its words in `notice.muted`, the command and the changelog's URL in `notice.accent`, a rule, and a blank line. The notice's own Tones are each like the general Tone of its name, `warning`, `muted` and `accent`, until a layer changes it, so a layer of `notice.warning` colours the notice alone, and each other warning stays in `warning`. This draws it as one line:

  ```js
  ctx.binnacle.look('notice.update', () => (update) => [ctx.binnacle.paint('muted', `binnacle ${update.version} is out: ${update.command}`), ''])
  ```

- A Look that returns no line tells nothing, and the version still counts as told.
- The row's config, in the profile's `cordis.patch.yml`, sets where it asks and what it keeps:

  ```yaml
  - id: binnacle-notice
    config:
      # Where npm gives the newest version. '' asks nothing.
      latest: https://registry.npmjs.org/@easeshine/binnacle/latest
      # The file that keeps the newest version told.
      told: ~/.dsh/binnacle/notice.json
  ```

- `@easeshine/binnacle/testing` loads the row with `latest: ''`, so a test asks npm nothing. To test the notice, load its module with a config of your own, as `mount`'s `plugins` take one.
