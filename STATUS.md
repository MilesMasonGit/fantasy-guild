# T-185 status (fix/t185-spritefx-server)

Dev server died after a full sprite-fx redraw.

## Measured so far (2026-10-15)
- Standalone `generateSpriteFx` (738 sprites, force): 3.5-3.9 s, peak RSS 105-110 MB.
- Own server, worktree only: in-server redraw 17.4 s, peak 454 MB, settles 243 MB, no crash.
- Own server with the main checkout's watch scope (the other worktrees mirrored in by
  junction under `.claude/worktrees`): the watcher alone reaches 211,296 handles and
  2.0-2.4 GB after ~3.5 min of scanning (nothing to redraw). That is the "2 GB orphan".
- Same scope + version-bump redraw at start: 31.6 s, no crash in 5 min.
  Same scope + forced redraw after the scan: 14.5 s, 6,331 watcher events, no crash.
  Same scope + config restart (version bump while running): redraw 38.3 s, no crash.
- Main checkout's output (from the 10-14 crash): files written 19:27:18 to 19:29:42,
  675 of 738 sprites, no manifest: the in-server run crawled and never finished.
- No node.exe crash event in the Windows Application log around the crash.

## Plan
- Run the dev-server redraw in a child process (own threadpool, native faults isolated).
- Kill the child when the server closes or restarts.
- Dev watcher ignores the nested `.claude/worktrees` (main checkout only).
- Build keeps the in-process run.

## Unproven
- The exact native trigger of 0xC0000409 (not reproduced in four attempts).
