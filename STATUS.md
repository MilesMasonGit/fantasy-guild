# T-185 status (fix/t185-spritefx-server)

Dev server died after a full sprite-fx redraw. Built, gated (tests, cycles,
build); ready for the director's merge. Not a look change.

## Done
- The dev server's redraw runs in a child process (`runSpriteFxInChild`),
  killed when the server closes or restarts; the build still draws in-process.
- The dev watcher ignores this checkout's `.claude/worktrees` (the main
  checkout only; a worktree's own server has none).
- Tests: `src/tests/SpriteFxPlugin.test.js` (11); 10 failed before the fix,
  each guard neutered once and caught.
- T-185 closed into `docs/archive/tickets_done.md`.

## Measured (same machine, back to back, main's watch scope mirrored by junction)
| | before | after |
|---|---|---|
| Vite watch handles | 211,296 | 6,276 |
| Vite memory, settled | 2.0-2.4 GB | 165-673 MB |
| Full redraw at start (version bump) | 31.6 s | 5.7 s |
| Redraw on a config restart | 38.3 s | 5.2 s |
| Generator alone (standalone) | 3.5-3.9 s, 105-110 MB peak | same |

## Unproven
- The exact native trigger of the original 0xC0000409: not reproduced in five
  attempts. Node's own fatal paths exit 134 here (measured), so it came from
  native code calling abort; which library is not known.
- Two dev servers on one checkout still both redraw into one folder.
