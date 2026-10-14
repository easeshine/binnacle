import type { System } from '../../index.ts'

// pi's limit: a terminal can drop a longer request to copy.
const MOST_OSC52_BASE64 = 100_000
const TOOL_MS = 3000
const POWERSHELL_MS = 5000

/** How a copy ended: a tool copied, only the terminal was asked to, or neither could be done, and why. */
export interface Copied {
  readonly outcome: 'copied' | 'sent' | 'failed'
  readonly reason?: string
}

const remote = ({ env }: System): boolean => Boolean(env['SSH_CONNECTION'] || env['SSH_CLIENT'] || env['MOSH_CONNECTION'])

const wsl = (system: System): boolean =>
  system.platform === 'linux' &&
  (Boolean(system.env['WSL_DISTRO_NAME'] || system.env['WSLENV']) || /microsoft|wsl/i.test(system.read('/proc/version') ?? ''))

const display = ({ env }: System): boolean => Boolean(env['DISPLAY'] || env['WAYLAND_DISPLAY'])

/** The system's own tools that take the text on their stdin, in the order they are tried. */
function toolsOf(system: System): readonly (readonly [string, readonly string[]])[] {
  const { platform, env } = system
  if (platform === 'darwin') return [['pbcopy', []]]
  if (platform !== 'linux') return []
  return [
    ...(env['TERMUX_VERSION'] ? [['termux-clipboard-set', []] as const] : []),
    ...(env['WAYLAND_DISPLAY'] ? [['wl-copy', []] as const] : []),
    ...(env['DISPLAY']
      ? ([
          ['xclip', ['-selection', 'clipboard']],
          ['xsel', ['--clipboard', '--input']],
        ] as const)
      : []),
  ]
}

/**
 * PowerShell reads the text from a UTF-8 file: its stdin, and `clip`'s, is read in the console's code page, which breaks text that is not ASCII.
 * WSL gives it the file's Windows path.
 */
async function viaPowerShell(text: string, system: System, signal: AbortSignal): Promise<boolean> {
  let path: string | undefined
  try {
    path = system.temporary(text)
    const shown = system.platform === 'win32' ? path : (await system.run('wslpath', ['-w', path], { ms: TOOL_MS, signal }))?.trim()
    if (shown === undefined || shown === '') return false
    const script = `Set-Clipboard -Value ([System.IO.File]::ReadAllText('${shown.replaceAll("'", "''")}', [System.Text.Encoding]::UTF8))`
    return (await system.run('powershell.exe', ['-NoProfile', '-Command', script], { ms: POWERSHELL_MS, signal })) !== undefined
  } catch {
    return false
  } finally {
    if (path !== undefined) system.remove(path)
  }
}

/** Copies the text as pi's `copyToClipboard` does: through the system's own tools, then by asking the terminal with OSC 52 over SSH or where no tool copied. */
export async function copyToClipboard(text: string, system: System, signal: AbortSignal): Promise<Copied> {
  let copied = false
  for (const [command, args] of toolsOf(system)) {
    if (signal.aborted) break
    if ((await system.run(command, args, { input: text, ms: TOOL_MS, signal })) !== undefined) {
      copied = true
      break
    }
  }
  if (!copied && !signal.aborted && (system.platform === 'win32' || (wsl(system) && !display(system))))
    copied = await viaPowerShell(text, system, signal)
  if (copied && !remote(system)) return { outcome: 'copied' }
  // OSC 52 carries base64 only, so the text cannot control the terminal.
  const encoded = Buffer.from(text, 'utf8').toString('base64')
  if (encoded.length > MOST_OSC52_BASE64) return copied ? { outcome: 'copied' } : { outcome: 'failed', reason: 'too long for the terminal' }
  if (signal.aborted) return { outcome: 'failed', reason: 'stopped' }
  system.write(`\x1b]52;c;${encoded}\x07`)
  return { outcome: copied ? 'copied' : 'sent' }
}
