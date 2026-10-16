import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'

import * as skillFilesystem from '@deepseek-ai/dsh-skill-filesystem'

export const name = 'binnacle-skill'

export const inject = ['skills'] satisfies (keyof Context)[]

// The package's own folder: the first one up from this file with a package.json, in its source and in its build.
function packageDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir)
  return dir
}

export function apply(ctx: Context): void {
  // A provider of its own, with only the package's skills, so that the skill's links to the docs resolve in the installed package.
  ctx.plugin(skillFilesystem, {
    providerName: 'binnacle',
    includeDefaultRoots: false,
    customSkillDirs: [join(packageDir(), 'skills')],
    // The package's skills change only with its version.
    watch: false,
  })
}
