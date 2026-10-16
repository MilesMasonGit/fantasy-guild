# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends, never stacked. Written
2026-10-15 afternoon by the director closing wave 2; the next director runs
the **art pass (brief 85)** with the owner, then wave 3 from the briefs queue.
Read `CLAUDE.md`, this file and `STATUS.md`, then verify each worktree with
`git -C .claude/worktrees/<name> status --short` and
`git log --oneline main..<branch>` before trusting anything here.*

## On `main` (pushed)

Everything from waves 1 and 2: briefs 20, 30, 40, 50, 60 (every P2 slice),
70 (Atlas A1–A12), 80 (terrain T0–T4: the ground plan, placement by terrain,
the drawn ground, the CMS "Stands on" field and the placing grid; the owner's
eye-check 2026-10-15 was all fine, no fix round needed), the three art tools
of brief 85 (`npm run art:bench`, `npm run art:brighten`, `npm run studio`),
the twitch fix, the cartographer's tutorial, the CMS-rename safety net,
drawers that close each other, the hover outline, the movable Guild Hall, the
still gear alert, stacked speech bubbles, drawing paused while minimised, and
the dev-server fix (the main folder's Vite no longer watches the agent
worktrees; sprite redraws run in a child process). Suite ~4960 green.

## Branches and worktrees

| Worktree | State |
|---|---|
| `pp` (`planning`) | The planning agent's. Leave it. |
| `ar` (`art/asset-reorg`) | The owner's art session. Leave it. |
| `p23b` (detached) | The director's scratch worktree for merges and gates; keep or remove. |
| `d` | Empty folder locked by a process; delete after a restart. |
| everything else | Merged and removed (junctions first, then `git worktree remove`). |

The merged feature branches stay local as history. A stray `STATUS.md` at the
repo root is an agent's note, git-ignored now; delete it if it bothers you.

## Eye-checks waiting

None. Archived with verdicts in `docs/archive/eyecheck/`.

## Owner to-dos (none urgent)

- Minimise the desktop app once to see the frame counter stop (the Rust side
  of drawing-pause compiles but has not run in the real app).
- CMS: the seedling sprite registration (one `it.fails` in AssetManager),
  re-accept the Starter Camp so its Bank names Oak Seedling, map trade ratios,
  "Stands on" on real Tokens once a Dock or Sailboat exists, Base Maps.
- The art weekend itself (brief 85's working sessions).

## Next batches (proposed; the director puts them to the owner)

1. **The art pass (brief 85):** the owner works the bench and the brightness
   script with one agent; the director supports (a tool that breaks, small
   changes the passes ask for). After the bake: A4 (drop the drag filter's
   brightness and saturation in `DndKit.jsx`), T-180's material palettes.
2. **Small tickets while the owner is on art:** T-181 (retake the bench
   baselines on a quiet night: `--save-baseline` for engine and draw), T-184
   (dev-panel dead items), T-183 (floor loot offset twice), T-167 (Recruits
   get a weak basic attack; an engine change, expect the work check to
   change), a 4× drag-bench pair for the placing grid (owed), the 1× fps
   spike from T-145's result if the owner ever cares.
3. **Wave 3 from the queue table** (`docs/active/briefs/README.md`): 100
   style kit, 110 map tools and top bar, 120 mat and Token card, 130 recipe
   list, 140 hero bar, 150 notifications, 160 Atlas tome and sky, 170 quest
   boards; brief 90 Envelope last.

## Lessons from this session

- Batches, not weekdays: the owner wants small batches with a look between
  them, whatever the day (recorded in CLAUDE.md and the director skill).
- Hand over an eye-check branch only after detaching the agent's worktree,
  switching the owner's folder, starting the server and seeing the slot
  screen (two failures on 2026-10-14 taught this; it is in the skill).
- Never pipe a git command whose failure matters; `git branch --show-current`
  before every commit (the owner switches branches between turns).
- The engine bench's timing against the Oct-7 baseline is noise under load;
  a control run of `main` is the tie-breaker and the work check decides.
  Retake the baselines (T-181).
- Keep-both on `package.json` can drop a comma; validate JSON after.
- An agent's worktree `STATUS.md` must stay untracked; it is ignored now.
- Subagent reports held up every time this session when checked against the
  code; the one thing that went wrong was scope assumed from stale docs (brief
  85 thought the terrain was next wave). Verify the state, not the docs.
