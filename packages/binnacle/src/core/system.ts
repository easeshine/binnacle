import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** What a copy touches of the system: its tools, its files and the terminal. A test puts its own in its place. */
export interface System {
  /** As node names it, such as `darwin`, `linux` or `win32`. */
  readonly platform: string
  readonly env: { readonly [name: string]: string | undefined }
  /**
   * Runs a tool with no shell, given `input` on its stdin, and kills it after `ms`, or when `signal` aborts.
   * What it wrote to its stdout, when it exits 0; `undefined` when it is not there, fails, or is killed.
   */
  run(
    command: string,
    args: readonly string[],
    options: { readonly input?: string; readonly ms: number; readonly signal?: AbortSignal },
  ): Promise<string | undefined>
  /** A file's text, or `undefined` where it cannot be read. */
  read(path: string): string | undefined
  /** Writes the text to a new file in the temporary folder, as UTF-8, readable only by the person, and gives its path. */
  temporary(text: string): string
  remove(path: string): void
  /** Writes to the terminal, past what binnacle holds back while it draws. */
  write(data: string): void
}

// Bound when the core loads, before binnacle holds back what other code writes, as the terminal's own write is.
const toTerminal = process.stdout.write.bind(process.stdout)

export const processSystem: System = {
  platform: process.platform,
  env: process.env,
  run: (command, args, { input, ms, signal }) =>
    new Promise((resolve) => {
      if (signal?.aborted === true) {
        resolve(undefined)
        return
      }
      // A clipboard tool can stay running in the background, so it is given no stdout to hold when nothing is read from it.
      const child = spawn(command, args, { stdio: ['pipe', input === undefined ? 'pipe' : 'ignore', 'ignore'], windowsHide: true })
      const out: Buffer[] = []
      let settled = false
      const finish = (result: string | undefined): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', kill)
        resolve(result)
      }
      const kill = (): void => {
        child.kill('SIGKILL')
        finish(undefined)
      }
      const timer = setTimeout(kill, ms)
      signal?.addEventListener('abort', kill)
      child.on('error', () => finish(undefined))
      child.on('close', (code) => finish(code === 0 ? Buffer.concat(out).toString('utf8') : undefined))
      child.stdout?.on('data', (chunk: Buffer) => out.push(chunk))
      // A tool can exit before it reads all of its input.
      child.stdin?.on('error', () => {})
      child.stdin?.end(input)
    }),
  read: (path) => {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return undefined
    }
  },
  temporary: (text) => {
    const path = join(tmpdir(), `binnacle-copy-${randomUUID()}.txt`)
    writeFileSync(path, text, { encoding: 'utf8', mode: 0o600 })
    return path
  },
  remove: (path) => {
    try {
      unlinkSync(path)
    } catch {
      // It may never have been written.
    }
  },
  write: (data) => {
    toTerminal(data)
  },
}
