# The command: how it is built

The package's bin, `binnacle`. For a person: `docs/use/index.md`. It is not an export: `vite.config.ts` builds `cli.ts` and leaves it out of `exports`.

- **binnacle stays a dsh plugin.** The command boots nothing itself: it checks, installs, and starts `dsh --profile binnacle` with the person's flags after it, where the core reads them (`../core/command-line.ts`).
- **It checks dsh first** (`launch.ts#launch`). The range is the package's own: each `@deepseek-ai/dsh` and `@deepseek-ai/dsh-*` peer, as dsh itself checks a plugin, with prereleases (`launch.ts#dshRange`). `dsh --version` gives the version. Outside the range, it says which dsh to install, and starts nothing. It never approves an incompatible version, as `dsh plugin allow-version` would.
- **It keeps the profile at the binnacle that runs.** A binnacle in a `node_modules` wants its version from npm; a checkout, in none, wants a link to itself. The profile's binnacle is a link when its real path is outside the profile. When the two disagree, it says both and runs `dsh plugin --profile binnacle add <spec>`, which makes the profile on the first run, and adds binnacle to its bundles. It reads the profile again after, as pnpm can end well and change nothing.
- **It changes no profile it did not make.** A `binnacle` profile with no dependency on the package is said, and left as it is. A profile that depends on binnacle but does not load it is said, with where to add it.
- **It installs neither dsh nor pnpm.** pnpm is looked for only when there is something to install.
- **dsh takes the process's place** (`process.ts#replace`): `process.execve`, so that ctrl+z, which suspends the core with `SIGSTOP`, stops the process that the shell waits on, and signals and the exit code are dsh's. Windows has no execve, so dsh runs there as a child through a shell, as its `.cmd` shim needs. Windows is not tested.
- **`DSH_HOME`** moves the profile, as it moves dsh's.
- **Tests** (`test/command.test.ts`) run `launch` with a fake `dsh` and `pnpm` on a PATH of their own.
