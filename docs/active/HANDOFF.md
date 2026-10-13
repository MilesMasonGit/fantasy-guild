# HANDOFF — what a fresh director resumes from

*Replaced whole each time the director stops (Saturday evening, ~85 % of the
weekly budget, or a full context), never stacked. Written 2026-10-13 09:45
Vancouver at the start of wave 1's finish; the director updates it when it
stops. A fresh session reads `CLAUDE.md`, this file and `STATUS.md` only,
then verifies each worktree with `git -C .claude/worktrees/<name> status
--short` and `git log --oneline main..<branch>` before trusting it.*

## On `main` (pushed)

Briefs 20, 30, 40, 50; brief 60 P1 (plan) and P2-1, P2-2, P2-4 (cap128 at 4×:
35 % → ~68 % of frames in budget); Atlas A1, A2, A3a, A3b, A4, A5, A6, A7,
A9, A10, A11; T-129; the process-review docs of 2026-10-13. The `planning` branch is fully merged.

## Branches and worktrees, verified 2026-10-13

| Branch | Worktree | State |
|---|---|---|
| `crunch/preview`, `crunch/atlas-a6`, `-a10`, `-a3b`, `-a11` | `atlas-a10`, `atlas-a3b`, `atlas-a11` | All merged to `main` 2026-10-13 after the owner's eye-check (the preview branch carried the two seam fixes). A11's CMS wording is synced into `data/` (`78ede7f8`). A12 merged the same day, eye-check deferred by the owner. The A3b drag-bench baseline is still in the bench queue. Worktrees disposable. |
| `crunch/p2-3` | `p2-3` | Complete: 2 commits, clean tree, full suite green (335 files). The enemy float-boundary fix is in `57e55545`. Merge conflicts only in CHANGELOG (keep both). Bench queued. |
| `crunch/p2-6` | `p2-6` | Complete and committed today (`2dee55f2`), full suite green (337 files). Bench queued. |
| `crunch/p2-5` | `p2-5` | Spike committed today (`04cf1307`): `will-change: contents` on a live hit loop plus a jsdom guard. The layer count and the pixel diff were never measured: bench queue. If the layer count does not drop, the spike is a no. |
| `crunch/optimize` | `o6` | P1 plan, merged. Disposable. |
| `crunch/atlas-a7` | `atlas-a7` | Merged. Disposable. |
| `art/asset-reorg` | `ar` | The owner's art session; leave it. |
| (detached) | `p23b`, `m` | Director scratch worktrees; `m` is detached now so the owner's folder could take `main`. Disposable. |
| folders only | `d`, `t129`, `atlas-a9`, `atlas-a4b`, `atlas-a6` | Pruned from git, folders busy on disk. Remove junctions first (`cmd //c rmdir` with the full path), confirm `ls <wt>/node_modules` fails, then delete; **never `rm -rf` through a junction**. The auto-mode classifier refuses worktree removals: the owner deletes these by hand or allows the command. |

## Eye-checks waiting

- None. The Atlas batch's file is archived with the verdict in
  `docs/archive/eyecheck/`. The owner's wider Atlas notes go to the planning
  session for the next wave.

## Owner to-dos

See NOW.md "Owner CMS to-do": one Sync on `main` (CMS restarted) writes A11's wording and the content.

## Next three phases

1. Benches for P2-3 and P2-6 in the 13:00 window, then merge both (keep-both
   on CHANGELOG), push; P2-5's layer count after them.
2. P2-7 sparse stack order (engineer; after P2-5 is decided, both touch the
   mat's stacking) and P2-8 tick/React per tick (engineer), in parallel.
3. P2-9 drags; A8 (A12 is merged).

## Lessons carried forward

- Usage limits kill subagents without a report: WIP commits hourly and a
  `STATUS.md` in the worktree are now in every tier file.
- Subagent benches run in parallel invalidated each other's numbers; now only
  the director benches, in the owner's downtime, one at a time.
- NOW.md grew three stacked handoffs; it is one screen again, with this file
  and STATUS.md beside it.
- `git merge-tree --write-tree` is not in this machine's git (2.37); dry-run
  merges with `git merge --no-commit --no-ff` in a scratch worktree, then
  `--abort`.
