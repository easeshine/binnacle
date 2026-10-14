# binnacle

A terminal app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh), mounted as a dsh bundle.

## Develop

```sh
vp install
pnpm refs        # fetches dsh and pi into .refs/, to read
vp run ready     # check, test and build everything
```

To run this checkout under dsh, make a profile that links the package, then build it:

```sh
mkdir -p ~/.dsh/profiles/binnacle && cd ~/.dsh/profiles/binnacle
# package.json: "dependencies": { "@easeshine/binnacle": "link:<this checkout>/packages/binnacle" }
#               "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@easeshine/binnacle"] } }
pnpm install
vp run @easeshine/binnacle#build   # in this checkout
dsh --profile binnacle
```

## Docs

The docs are in [`packages/binnacle/docs/`](packages/binnacle/docs/): what a person can do in `use/`, and what an author can change in `author/`. The package carries them, and the website shows them. Run the website with `vp run dev`.

## Licence

MIT
