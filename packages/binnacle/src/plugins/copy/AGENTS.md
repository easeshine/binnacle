# Copying: how it is built

Row `binnacle-copy` · Intent: [Select and copy](../../../../../intents/select-and-copy/intent.md). For a person: `docs/use/copy.md`. For an author: `docs/author/built-ins/copy.md`.

- **The core holds the Selection, and this row copies it** (`index.ts`). The row sets the action `copy.selection`, keys `['select']`, with no Place, enabled while the core's model `selection` has a Selection. It copies the model's text. A text of blank rows copies nothing, so the clipboard keeps what it held. An author who binds the action to a key, or sets it with a `run` of their own, changes copying with no API of its own.
- **The model `copy`** is `{ last }`: the newest copy that finished, `{ outcome, reason, at }`, `at` read from `internals.now()`. A copy started after another wins: an older copy that ends later is dropped. When the row unloads, it aborts each copy it waits on, which kills its tool, and the model goes with it. The status line draws it ([Status line](../status-line/AGENTS.md)).
- **The route follows pi's `copyToClipboard`**, copied with credit, without pi's native addon (`clipboard.ts#copyToClipboard`). It reaches the system through `internals.system`, which a test fakes: the tools, the environment, the files and the terminal.
  - Each tool runs with no shell, the text on its stdin, and is killed after 3 seconds. The first that exits 0 wins. A tool that fails or is killed hands on to the next.
  - macOS runs `pbcopy`. Linux runs `termux-clipboard-set` in Termux, `wl-copy` under Wayland, then `xclip` and `xsel` under X, each only where its environment is set, as pi does.
  - On Windows, and in WSL with no display, PowerShell reads the text from a UTF-8 file in the temporary folder, readable only by the person, into `Set-Clipboard`, and is killed after 5 seconds. The file is removed after, whatever the outcome. WSL gives it the file's Windows path from `wslpath -w`. A WSL is found as pi finds it: `WSL_DISTRO_NAME`, `WSLENV`, or `/proc/version`.
  - OSC 52 is written over SSH or mosh (`SSH_CONNECTION`, `SSH_CLIENT` or `MOSH_CONNECTION`), and wherever no tool copied. Its base64 is at most 100 000 bytes. Longer, where no tool copied, the copy fails as `too long for the terminal`. A copy aborted before it writes writes nothing.
  - The outcome is `copied` when a tool copied, `sent` when only OSC 52 was written, as no terminal confirms it, and `failed` when neither could be done.
- **Where the route differs from pi, on purpose:**
  - pi runs `clip` on Windows. binnacle uses its PowerShell route there too, as `clip` reads its stdin in the console's code page, which breaks text that is not ASCII.
  - pi writes OSC 52 locally only on Linux with no display. binnacle writes it wherever no tool copied.
  - pi reports an OSC 52 write as copied. binnacle reports it as only sent.
  - pi prefers OSC 52 in Windows Terminal under WSL. binnacle runs PowerShell, which it can confirm.
- **Untrusted Text:** the core makes the rows plain before they are the model's text. OSC 52 carries base64 only, and each tool takes the text on stdin, never in an argument.
