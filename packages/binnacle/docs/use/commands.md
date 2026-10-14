# Commands

Row `binnacle-commands`. To turn it off, see [Features](index.md#features). To change it, see [its page for authors](../author/built-ins/commands.md).

- Type `/` in the composer, and see dsh's commands above it, in the registry's order, the first marked. Each is its name, without the `/` that the draft above shows, with its description in the `muted` Tone.
- Type on, and see the offer narrow to the commands whose names match: the names that start with what is typed first, then the closest. While no command matches, the offer draws nothing.
- Move the mark with up and down while typing. They wrap. Page up and page down move the mark by a page, and stop at the first and the last command. With more than 8 commands, the offer shows 8, and keeps the mark in view.
- Pick a command with enter or a click. A command that takes no input runs at once. A command that takes input puts `/<name> ` in the draft, with the cursor at its end, for its input. Tab puts `/<name> ` in the draft, whichever the command.
- Close the offer with esc, and keep the draft. The offer opens again when the draft changes. With no offer, esc interrupts the turn, as before.
- See the offer close when the draft stops being `/` and a name. A space after the name, a new line, or the `/` taken out closes it.
- See a command that a plugin registers or removes while the offer is open show in it, or go from it, at once.
- On a stored session, or before the session opens, see nothing offered.
- Turn the row off, and see nothing offered, while a command typed in full still runs ([Composer](composer.md)).
