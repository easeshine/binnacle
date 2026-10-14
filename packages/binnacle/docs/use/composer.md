# Composer

Row `binnacle-composer`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/composer.md).

- Type a draft in the Chat's composer, between two rules, with pi-tui's editor keys.
- Make a new line with shift+enter; a paste keeps its new lines.
- Send the draft as a prompt with enter, or steer the turn that runs. The draft goes into its history. A draft of whitespace sends nothing.
- Run a command with enter on a draft that is a command line, such as `/compact`. The model never sees the line. The transcript shows `/compact` and what the command said. A command that fails keeps the draft. A line whose name is no command, such as a skill's `/name`, is sent as a prompt.
- Interrupt the turn that runs with esc.
- Clear the draft with ctrl+c. On an empty draft, ctrl+c pressed twice within half a second quits.
- On a stored session, enter keeps the draft, as nothing can be sent.
- See the draft again, as it was, once no Request stands.
