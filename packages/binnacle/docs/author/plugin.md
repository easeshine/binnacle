# A plugin

A plugin is a Cordis plugin, in a package of its own: an ES module that exports `name`, `inject` and `apply`.

```js
// plugins/my-change/index.js
export const name = 'my-change'
export const inject = ['binnacle']
export function apply(ctx) {
  ctx.binnacle.theme({ colors: { accent: 'magenta' } })
}
```

```json
{ "name": "my-change", "version": "0.0.0", "type": "module", "main": "index.js" }
```

A plugin in TypeScript imports the types with `import type { Binnacle, Part } from '@easeshine/binnacle'`. That import also gives `ctx.binnacle` its type. The types come with the package.

## Load it in a profile

A dsh profile is a folder, `~/.dsh/profiles/<profile>/`. A profile runs binnacle when its `package.json` has `@easeshine/binnacle` in its dependencies, and `"dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@easeshine/binnacle"] } }`. The `binnacle` command makes such a profile, `binnacle`, and keeps only binnacle's own version in it: a plugin that you add there, `binnacle` starts too.

1. Put the plugin in the profile, such as in `plugins/my-change/`.
2. Add it to the dependencies of the profile's `package.json`: `"my-change": "link:./plugins/my-change"`.
3. Run `pnpm install` in the profile.
4. Add a row for it to the profile's `cordis.patch.yml`:

   ```yaml
   - insert:
       - id: my-change
         name: 'my-change'
   ```

5. Start binnacle with `dsh --profile <profile>`.

Hot reload is off. After you change the plugin, start binnacle again.

## Turn a built-in off

Each built-in feature is a row of this package's `cordis.patch.yml`. Turn it off by its row, in the profile's `cordis.patch.yml`:

```yaml
- id: binnacle-status-line
  disabled: true
```

The core, row `binnacle`, cannot be turned off. Every feature needs it.

## Test it

`@easeshine/binnacle/testing` runs binnacle with no terminal, on a fake agent and a fake clock, with the built-ins and your plugins loaded as a profile loads them. Read the screen as a person sees it, as plain rows. This tests the plugin of [The turn](concepts/models.md#the-turn), in `plugins/elapsed/index.js`, with `node --test`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount } from '@easeshine/binnacle/testing'
import * as elapsed from './index.js'

test('the status line shows how long the turn has run', async () => {
  const app = await mount({ size: { columns: 30, rows: 5 }, plugins: [elapsed] })
  try {
    await app.agent.status('running')
    await app.agent.commit({ type: 'turn/start', data: { turn: 1 } })
    await app.clock.pass(65_000)
    assert.equal((await app.screen())[1], 'running 1:05 · deepseek-v4')
  } finally {
    await app.close()
  }
})
```

- `mount(options)` takes the terminal's `size`, 80 × 24 by default; `builtins`, the rows of the bundle by id, `'all'` by default, or `[]` for none; `plugins`, your plugins, each a module or `[module, config]`; `stored`, `{ id, events }`, to open a stored session in place of a new one; `model`, `{ provider, model }`, the fake agent's model, `deepseek-v4` by default; and `provide(ctx)`, to provide a service of dsh's that your test fakes, such as `tools` for a tool's views or `commands` for dsh's commands. A service by the name of one of the mount's own fakes, `agents` or `agentDefaultModel`, replaces it: an `agents` whose `create` never settles keeps the session from opening.
- `screen()` gives the rows. `style(x, y)` gives how a cell is drawn, and `cursor()` the cell where the core puts the cursor of the Part with the Focus.
- `press(key)` sends a key by name, such as `enter`, `escape`, `shift+tab`, `up`, `pagedown` or `ctrl+k`, `type(text)` sends text, and `click(x, y)`, `drag(from, to)` and `wheel(x, y, notches)` send the mouse, each as a terminal sends it. A click is a press and its release, and a second click on the same word within 500 ms on the fake clock is a double click. `drag` takes a cell, or a list of cells to move through, and `drag(from, to, held)` holds the button there for `held` ms on the fake clock, as a drag held past a Place's edge scrolls it. `resize(columns, rows)` resizes the terminal.
- `agent.status(status)`, `agent.commit({ type, data })` and `agent.stream(frame)` do what dsh does in a session: an event's seq is the next, and its time the fake clock's, unless it names `seq` or `time`. `agent.sent` is what the session sent the agent, and `agent.cancels` each time it interrupted the turn, with what it asked dsh's agent to cancel with.
- `ask(questions)` and `approve(toolName, { callId, reason })` are a question and an approval that a tool asks. Each gives what the person answers, once they answer. Give either `signal` to withdraw it, and `agent: app.agent.child(id)` to ask as a subagent.
- `clock.pass(ms)` moves the fake clock, and runs each timer that falls due. `clock.now` is its time.
- `copied` lists each text that reached the clipboard, oldest first. The mount's clipboard always copies.
- `binnacle` is the binnacle service, and `ctx` the Context that dsh's services and events live on, for what the calls above do not drive. `unload(name)` unloads a row by its id, such as `binnacle-composer`, or the core's `binnacle`, or your plugin by its `name`. `exits` holds each code that binnacle asked dsh to exit with, such as `0` after ctrl+c twice on an empty draft.
- Each call that drives binnacle settles once binnacle has drawn what it causes.
- One mount is open at a time in a process, as the core holds one terminal: `mount` throws while another is open. `close()` unloads every plugin, those that a test loaded on `ctx` too, and puts back what the mount replaced. A closed mount throws at each call. A question or an approval that still stands is dismissed.
- The core and the built-ins load as rows of a profile, so they rank beneath your plugins as they do under dsh.
