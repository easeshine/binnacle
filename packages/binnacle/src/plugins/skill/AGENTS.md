# The skill: how it is built

Row `binnacle-skill` · Intent: [Colours](../../../../../intents/palette/intent.md). For a person: `docs/use/colours.md`. For an author: `docs/author/built-ins/skill.md`.

- **The row is a provider of dsh's skills, and draws nothing.** It loads dsh's `skill-filesystem` with `{ providerName: 'binnacle', includeDefaultRoots: false, customSkillDirs: [<the package's skills/>], watch: false }`, so the catalog of `ctx.skills`, which dsh's `tool-skill` gives the Chat's agent, holds `binnacle` in every session. A provider of its own sees only the package's skills, and none of the person's roots twice. The package's skills change only with its version, so nothing watches them.
- **The package's folder is found up from the module**, the first folder with a `package.json`, as the notice finds its manifest. So `skills/` resolves from the source in a test and from `dist/` once installed, and the skill's links to `docs/` resolve as they do on disk.
- **The skill's description is all the agent sees until it loads the skill.** It names a change to binnacle's colours, keys, layout and features, and an example a person would say. Its section on colours sends a person's colour to `$DSH_PROFILE_DIR/palette.json`, which dsh's `shell-env` sets in the agent's shell, and never to a plugin, as the file wins over every plugin.
- **With no `skills` service**, as with no dsh-base beneath, the row does not start.
