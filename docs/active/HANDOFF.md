# HANDOFF — what a fresh director resumes from

*Replaced whole each time the director stops (Saturday evening, ~85 % of the
weekly budget, or a full context), never stacked. Written 2026-10-13 09:45
Vancouver at the start of wave 1's finish; the director updates it when it
stops. A fresh session reads `CLAUDE.md`, this file and `STATUS.md` only,
then verifies each worktree with `git -C .claude/worktrees/<name> status
--short` and `git log --oneline main..<branch>` before trusting it.*

## On `main` (pushed)

Briefs 20, 30, 40, 50; brief 60 P1 (plan) and P2-1, P2-2, P2-4 (cap128 at 4×:
35 % → ~68 % of frames in budget); Atlas A1, A2, A3a, A4, A5, A7, A9; T-129;
the process-review docs of 2026-10-13. The `planning` branch is fully merged.

## Branches and worktrees, verified 2026-10-13

| Branch | Worktree | State |
|---|---|---|
| `crunch/preview` | none (was the owner's folder) | `main` as of 2026-10-10 + A6 + A10 + A3b + A11 + two seam fixes (`03812184`: fixed Tokens respect the dev layout tool for landmarks; the fixed-Token tests no longer import the removed bin). Gate green there (4651 tests, build). **Carry `03812184` over when A10 and A3b merge** (`git cherry-pick 03812184` onto `main` after them, or merge the preview branch itself). |
| `crunch/atlas-a6` | none | A6 Atlas and Cartography screens, Token Cap and Cartography Table upgrades. Eye-check. |
| `crunch/atlas-a10` | `atlas-a10` | A10 fixed vs movable Tokens, faint marker. Eye-check. |
| `crunch/atlas-a3b` | `atlas-a3b` | A3b bin gone, Demolish / Cancel / Dismiss bounty on the inspection. Eye-check; drag-bench baseline not retaken (bench queue). |
| `crunch/atlas-a11` | `atlas-a11` | A11 no tier labels; the CMS description patch is parked on the branch. **Owner** applies it and Syncs on this branch, then it merges. |
| `crunch/p2-3` | `p2-3` | Complete: 2 commits, clean tree, full suite green (335 files). The enemy float-boundary fix is in `57e55545`. Merge conflicts only in CHANGELOG (keep both). Bench queued. |
| `crunch/p2-6` | `p2-6` | Complete and committed today (`2dee55f2`), full suite green (337 files). Bench queued. |
| `crunch/p2-5` | `p2-5` | Spike committed today (`04cf1307`): `will-change: contents` on a live hit loop plus a jsdom guard. The layer count and the pixel diff were never measured: bench queue. If the layer count does not drop, the spike is a no. |
| `crunch/optimize` | `o6` | P1 plan, merged. Disposable. |
| `crunch/atlas-a7` | `atlas-a7` | Merged. Disposable. |
| `art/asset-reorg` | `ar` | The owner's art session; leave it. |
| (detached) | `p23b`, `m` | Director scratch worktrees; `m` is detached now so the owner's folder could take `main`. Disposable. |
| folders only | `d`, `t129`, `atlas-a9`, `atlas-a4b`, `atlas-a6` | Pruned from git, folders busy on disk. Remove junctions first (`cmd //c rmdir` with the full path), confirm `ls <wt>/node_modules` fails, then delete; **never `rm -rf` through a junction**. The auto-mode classifier refuses worktree removals: the owner deletes these by hand or allows the command. |

## Eye-checks waiting

- [eyecheck/2026-10-13_atlas-m1-m2.md](eyecheck/2026-10-13_atlas-m1-m2.md):
  A6, A10, A3b, A11 on `crunch/preview`. The owner's play-testing notes from
  the preview branch fold into it when given.

## Owner to-dos

See NOW.md "Owner CMS to-do" and the A11 patch step. Don't Sync to Game while
on `crunch/preview`.

## Next three phases

1. Benches for P2-3 and P2-6 in the 13:00 window, then merge both (keep-both
   on CHANGELOG), push; P2-5's layer count after them.
2. P2-7 sparse stack order (engineer; after P2-5 is decided, both touch the
   mat's stacking) and P2-8 tick/React per tick (engineer), in parallel.
3. P2-9 drags; then A8 and A12 once the Atlas batch merges.

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
