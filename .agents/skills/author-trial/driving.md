# Drive binnacle under dsh with herdr

Run dsh in a herdr pane of its own, and drive the pane from the shell. herdr answers each command with JSON.

| To | Run |
|---|---|
| start | `herdr tab create --cwd <project> --label <name> --no-focus`, then `herdr pane run <pane> "dsh --profile <profile>"`. Read the pane id from `result.root_pane.pane_id`, and the tab id from `result.tab.tab_id`. |
| start in PTC mode | the same, with `DSH_TOOLS_MODE=ptc` before `dsh`. binnacle's bundle reads the tools mode from it. |
| answer a shell's update prompt | `herdr pane run <pane> "n"`, before you start dsh. A new tab can ask for an update, and that prompt takes the first key. |
| wait until binnacle is up | read the screen until its status line shows `idle` |
| type | `herdr pane send-text <pane> "<text>"` |
| send a prompt | type it, then `herdr pane send-keys <pane> Enter`. Read the screen until the status line shows `idle` again. |
| press a key | `herdr pane send-keys <pane> Enter`, `Up`, `esc`, `shift+Tab`, `C-c` |
| click at a column and a row, from 1 | `herdr pane send-text <pane> "$(printf '\033[<0;%s;%sM\033[<0;%s;%sm' $col $row $col $row)"`. The press and the release must both be escapes, or the release is typed into the Place that has the Focus. |
| scroll up one notch | the same, with `64` for `0`, and only the `M` half |
| read the screen | `herdr pane read <pane> --source visible` |
| read its styles | `herdr pane read <pane> --source visible --ansi` |
| quit | `herdr pane send-keys <pane> C-c C-c`. On a draft that has text, send one `C-c` first, which clears it. |
| close | `herdr tab close <tab>` |

binnacle scrolls the transcript itself, so the terminal's scrollback does not hold it. To see each event that dsh wrote, read the stored session:

```sh
zstd -dc ~/.dsh/sessions/<cwd>/session-<id>/session.v4.jsonl.zstd
```

Each line is an event. Its `type` and `data` say what the loop wrote, such as `tool/call`, `tool/result`, or `tool/ptc-dispatch` in PTC mode.

## Turn on one plugin

Each plugin's row in the profile's `cordis.patch.yml` has `disabled: true`. To try one plugin, set its row to `disabled: false`, and every other row to `true`. Then start dsh again: hot reload is off.
