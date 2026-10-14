import { spawn, spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'

// Windows starts a package's command through its .cmd shim, which only a shell runs, and a shell reads one line of text.
const line = (file: string, args: readonly string[]) => [file, ...args].map((part) => `"${part}"`).join(' ')

/** The path of a command on PATH, or undefined when no folder on PATH has it. */
export function find(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | undefined {
  const extensions = platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : ['']
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (dir === '') continue
    for (const extension of extensions) {
      const path = join(dir, name + extension)
      try {
        accessSync(path, platform === 'win32' ? constants.F_OK : constants.X_OK)
        if (statSync(path).isFile()) return path
      } catch {
        // Not in this folder.
      }
    }
  }
  return undefined
}

export interface Ran {
  readonly status: number
  readonly stdout: string
}

/** Runs a command to its end. With `terminal`, it prints to the person; else what it prints to stdout is read. */
export function run(file: string, args: readonly string[], env: NodeJS.ProcessEnv, platform: NodeJS.Platform, terminal: boolean): Ran {
  const options: SpawnSyncOptionsWithStringEncoding = { env, encoding: 'utf8', stdio: terminal ? 'inherit' : ['ignore', 'pipe', 'inherit'] }
  const result = platform === 'win32' ? spawnSync(line(file, args), { ...options, shell: true }) : spawnSync(file, args, options)
  return { status: result.status ?? 1, stdout: result.stdout ?? '' }
}

// ctrl+c reaches a child from the console, so this process lets it pass, and waits for the child to end.
const ignore = () => {}

/**
 * Puts the command in this process's place, so that its signals, its suspend and its exit code are the person's.
 * Windows has no such call, so there the command runs as a child, and its exit code is given back.
 */
export async function replace(file: string, args: readonly string[], env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<number> {
  if (platform !== 'win32' && process.execve !== undefined) process.execve(file, [file, ...args], env)
  process.on('SIGINT', ignore)
  const child = spawn(line(file, args), { env, stdio: 'inherit', shell: true })
  const code = await new Promise<number>((resolve) => {
    child.on('exit', (status) => resolve(status ?? 1))
    child.on('error', () => resolve(1))
  })
  process.off('SIGINT', ignore)
  return code
}
