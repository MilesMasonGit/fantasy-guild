# HANDOFF — what a fresh director resumes from

*Replaced whole each time the director stops (Saturday evening, ~85 % of the
weekly budget, or a full context), never stacked. Updated 2026-10-13 14:00
Vancouver at the end of day 1 of wave 1's finish. A fresh session reads `CLAUDE.md`, this file and `STATUS.md` only,
then verifies each worktree with `git -C .claude/worktrees/<name> status
--short` and `git log --oneline main..<branch>` before trusting it.*

## On `main` (pushed)

Briefs 20, 30, 40, 50; brief 60 P1 (plan) and P2-1 to P2-6 and P2-8 (S2 at 4×
now 31 % of frames in budget against the Oct-7 draw baseline's 6 %); Atlas A1
to A7, A9 to A12; T-129; the process-review docs of 2026-10-13; the content
re-pin after the owner's Oak Seedling rename. The `planning` branch is fully merged.

## Branches and worktrees, verified 2026-10-13

| Branch | Worktree | State |
|---|---|---|
| `crunch/preview`, `crunch/atlas-a6`, `-a10`, `-a3b`, `-a11` | `atlas-a10`, `atlas-a3b`, `atlas-a11` | All merged to `main` 2026-10-13 after the owner's eye-check (the preview branch carried the two seam fixes). A11's CMS wording is synced into `data/` (`78ede7f8`). A12 merged the same day, eye-check deferred by the owner. The A3b drag-bench baseline is still in the bench queue. Worktrees disposable. |
| `crunch/p2-3`, `crunch/p2-5`, `crunch/p2-6`, `crunch/p2-8` | `p2-3`, `p2-5`, `p2-6`, `p2-8`, `p28a` | All merged 2026-10-13 afternoon on the work check (timing against the Oct-7 baseline is 1.3–1.5× slower for `main` itself under the day's load: retake the baseline on a quiet evening, T-111). Worktrees disposable (junctions first). |
| `crunch/atlas-a8` | `atlas-a8` | A8 the cartographer's tutorial: gate and bench green, waits on the owner's read of [eyecheck/2026-10-13_atlas-a8.md](eyecheck/2026-10-13_atlas-a8.md). Owner ruling on the fight step: keep it, T-167 filed. |
| `crunch/atlas-a12`, `fix/content-repin`, `fix/a11-cms-composer`, `chore/*` | `atlas-a12`, `repin` | Merged. Disposable. |
| `crunch/optimize` | `o6` | P1 plan, merged. Disposable. |
| `crunch/atlas-a7` | `atlas-a7` | Merged. Disposable. |
| `art/asset-reorg` | `ar` | The owner's art session; leave it. |
| (detached) | `p23b`, `m` | Director scratch worktrees; `m` is detached now so the owner's folder could take `main`. Disposable. |
| folders only | `d`, `t129`, `atlas-a9`, `atlas-a4b`, `atlas-a6` | Pruned from git, folders busy on disk. Remove junctions first (`cmd //c rmdir` with the full path), confirm `ls <wt>/node_modules` fails, then delete; **never `rm -rf` through a junction**. The auto-mode classifier refuses worktree removals: the owner deletes these by hand or allows the command. |

## Eye-checks waiting

- [eyecheck/2026-10-13_atlas-a8.md](eyecheck/2026-10-13_atlas-a8.md): the
  eleven cartographer lines and three in-game checks. The Atlas batch and A12
  files are archived with their verdicts.

## Owner to-dos

See NOW.md "Owner CMS to-do": one Sync on `main` (CMS restarted) writes A11's wording and the content.

## Next three phases

1. P2-7 sparse stack order (engineer) and P2-9 drags (engineer), in parallel
   from `main`, Wednesday morning; benches in the 13:00 window.
2. A8 merges on the owner's read (fixes from the read first).
3. Regroup on the planning docs and plan wave 2 (brief 80 terrain, brief 90).

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
- Never pipe a git command whose failure matters (`git merge --ff-only … |
  tail -1 && …` continues on failure: the pipe's status is `tail`'s). Run it
  bare, then read the result. Check `git branch --show-current` before every
  commit: the owner's folder changes branch between turns.
- Content tests pin `data/` ids; an owner rename in the CMS turns them red
  and can leave code paying a dead item (the first tutorial quest did). Grep
  code for the old id after any rename sync.
