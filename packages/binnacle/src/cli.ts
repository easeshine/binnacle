#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { launch } from './command/launch.ts'
import { replace } from './command/process.ts'

process.exitCode = await launch({
  argv: process.argv.slice(2),
  packageDir: fileURLToPath(new URL('..', import.meta.url)),
  env: process.env,
  platform: process.platform,
  print: (line) => process.stdout.write(`${line}\n`),
  say: (line) => process.stderr.write(`${line}\n`),
  start: (dsh, args) => replace(dsh, args, process.env, process.platform),
})
