# The skill

The row `binnacle-skill` puts binnacle's skill, `skills/binnacle/SKILL.md` of the package, in the catalog of dsh's skills, so the Chat's agent has it in every session. It draws nothing.

- It loads dsh's `skill-filesystem` as a provider of its own, named `binnacle`, with only the package's `skills/` folder. The agent sees the skill's name and description, and loads its body when a request matches it, as dsh's `tool-skill` asks. The body's links to the docs resolve in the installed package.
- The skill sends a colour that a person asks for to their own `palette.json`, at `$DSH_PROFILE_DIR/palette.json`, and a change of keys, layout or a feature to a plugin, through these pages.
- The row needs dsh's `skills` service, which dsh-base gives. With none, it does not start.
- With the row off, the agent does not know binnacle. A skill of your own named `binnacle` in a project's `.dsh/skills/` or `.agents/skills/` wins over the package's, as dsh ranks a project's skills first. One in `~/.dsh/skills/` does not.
