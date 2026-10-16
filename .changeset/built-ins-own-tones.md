---
'@easeshine/binnacle': patch
---

Each built-in draws in pi's Tone for what it draws, and in Tones of its own, so a theme colours one piece alone and a palette made for pi reaches it. Markdown draws a code block in `mdCodeBlock`, a quote in `mdQuote` and `mdQuoteBorder`, a rule in `mdHr`, a link's address in `mdLinkUrl` and a list's bullet in `mdListBullet`. A tool card draws its counts in `toolDiffAdded` and `toolDiffRemoved`, its title in `toolTitle` and a shell's output in `toolOutput`, and a prompt draws in `userMessageText` and reasoning in `thinkingText`. The tool cards, the transcript's view, the composer, the status line and the notice each give their own Tones, such as `transcript.card.error`, which look like the general Tone until a layer changes them. Nothing looks different with no layer.
