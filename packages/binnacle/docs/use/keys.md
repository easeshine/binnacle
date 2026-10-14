# Keys and the mouse

- Use the keyboard and the mouse through actions: each action has an id, its default keys and a description. The editor's keys are in the Gesture Table, and the core's own gestures are actions, as an author's are, and as the composer's submit and new line are.
- Move the Focus to the next Place that takes keys with shift+tab, or with a click on a Place that takes keys: one whose Part takes keys, or that an action acts in. A click on a Place inside a node with `clickFocus: false`, such as the Chat's transcript, acts there and moves no Focus. A Screen shown over another has its own Focus, and the one under it gets its Focus back.
- Click a Part: the click reaches the Part under the pointer, with or without the Focus. Only the left button clicks. A click acts when you let go, on the cell where you pressed. A press that moves selects, and clicks nothing ([Select and copy](copy.md)).
- Double-click a word or triple-click a line to select it. Only the first click of the run acts as a click.
- Scroll with the wheel.
- Select with shift and a drag, as the terminal selects, where binnacle takes the mouse.

## Lists, Lines and Tabs

- See the borders of each box drawn dim, in the theme's `border` Tone, so they stand back from what the box holds.
- See binnacle in your own palette: each default Tone is one of the terminal's sixteen colours, or only an attribute.
- Pick an item of a List: up and down move its mark, and wrap; page up and page down move it by a page, and stop at the first and the last item; enter picks the marked item, and a click picks the item clicked. The Requests' Choices are a List.
- Move the mark of a List while you type in another Place, such as a Line, where the List's author names it: up, down, page up, page down and enter act on the List while it draws a line, and go to what you type in while it draws none. The offer of commands does this, in the composer ([Commands](commands.md)).
- Keep your place in a List taller than its Place: a mark that moves within the rows shown moves no row, and a mark that moves past an edge brings the view on until the mark is at that edge.
- Read a Title: a rule across the width, with its text in it.
- See lines drawn in a box by the Kit, with a title in its top edge, its edge in the `border` Tone or in another Tone that the author chose.
- Type in a Line: it takes every key while it is shown, enter submits the text and escape escapes. Its text stays after a submit, an escape, or while it is hidden. A Request's typed answer is a Line.
- Read markdown drawn by the Kit, such as an answer in the transcript: headings, bold, italic, inline code, code blocks, lists, quotes, links and rules, wrapped at the width, in the Tones `heading`, `code` and `link`.
- Move between Tabs: tab goes to the next and shift+tab to the one before, and they wrap at each end, even while a Line takes the keys. A click on a tab goes to it. When the Tabs are wider than the screen, the current tab shows with its neighbours that fit, and `…` marks each end where the row is cut. Nothing built-in draws Tabs yet.
