import { afterEach, test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
import { mount } from '../../src/testing/index.ts'
import type { Mounted } from '../../src/testing/index.ts'

let app: Mounted | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const skillDir = fileURLToPath(new URL('../../skills/binnacle', import.meta.url))

test("The Chat's agent has binnacle's skill in its catalog in every session, and the skill tells it to change a person's colour in palette.json", async () => {
  // dsh's row `skill`, as dsh-base loads it: the catalog that the agent's `tool-skill` reads.
  app = await mount({ builtins: ['binnacle-skill'], provide: (ctx) => void ctx.plugin(SkillRegistry) })
  const listed = (await app.ctx.skills.list()).map(({ name, provider, source }) => ({ name, provider, source }))
  assert.deepEqual(listed, [{ name: 'binnacle', provider: 'binnacle', source: 'custom' }])
  const skill = await app.ctx.skills.get('binnacle')
  assert.ok(skill !== undefined)
  // The body's links to the docs resolve from the skill's own folder in the package.
  assert.deepEqual(skill.resourceBase, { kind: 'directory', path: skillDir })
  assert.match(skill.description, /colours/)
  assert.match(skill.content, /palette\.json/)
  assert.match(skill.content, /\$DSH_PROFILE_DIR\/palette\.json/)
})
