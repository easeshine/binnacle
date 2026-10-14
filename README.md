# binnacle

A terminal app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh), mounted as a dsh bundle.

## Develop

```sh
vp install
pnpm refs        # fetches dsh and pi into .refs/, to read
vp run ready     # check, test and build everything
```

To run this checkout under dsh, build it and start its command. A `binnacle` run from a checkout links the checkout into binnacle's dsh profile, `~/.dsh/profiles/binnacle`, in place of a version from npm:

```sh
vp run @easeshine/binnacle#build
node packages/binnacle/dist/cli.mjs
```

After a change, build again, and start it again.

## Docs

The docs are in [`packages/binnacle/docs/`](packages/binnacle/docs/): what a person can do in `use/`, and what an author can change in `author/`. The package carries them, and the website shows them. Run the website with `vp run dev`.

## Licence

MIT
