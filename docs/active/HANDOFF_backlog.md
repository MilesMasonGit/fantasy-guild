# HANDOFF — the Backlog director (brief 210)

*The Backlog director's own handoff, replaced whole each time it ends (the
terrain director keeps [HANDOFF.md](HANDOFF.md), the features director
[HANDOFF_features.md](HANDOFF_features.md); the Systems director, building
combat and skill loops, shares STATUS.md, the main folder and the PC).
Written 2026-10-24 night, at the end of the session of 22–24 October. Read
`CLAUDE.md`, this file and `STATUS.md`, then verify with `git worktree list`
and `git log --oneline -5` before trusting anything here.*

## Done (main 7f6a1166, pushed)

**Brief 210 is complete**, plus every follow-up the owner approved. Each phase
was okayed by the owner by phone (away 23–25 October) and gated on the merged
result: tests, cycles, build, the engine work check; draw and drag benches
where they apply. Eye-check records with the owner's verdicts and a "when
you're back at the PC" list: `docs/archive/eyecheck/2026-10-23_backlog-A.md`,
`2026-10-23_backlog-BC.md`. Cost lines: PERFORMANCE "UI rework cost log".

- A: mat 12 × 6.5; top bar on the Region banner; flag reach 240; hitbox 90 %.
- B: names below; quieter mat; forbidden-only drag tint; five loot effects off;
  pickups fly from where they stand.
- C: item tiles; one item, one hero; "New!" clears; the Bank's hero tabs as
  portraits; equip shine; Work Permissions button and drawer.
- D: calmer Hall sky; Effects popover; pixel Inspect panel; the camera glide.
- E: drawers to the edge, smooth Bank opening; the Atlas spread; dev tools.
- F: pixel frames round one (windows); the work plate (cheaper than what it
  replaced).
- Follow-ups: pixel frames round two (T-242, kit pieces in UI_STYLE); the
  speech frame (T-243); the drag bench's Shop and Bank kinds (T-240); loot
  under the drawers (T-241); the gear tip above the plate (T-247); orbs
  without glow (T-244) and a gold selected orb (T-252); the plate's
  wrong-Token pickups found by the drag bench and fixed.

## Branches and worktrees

- Only `p23b` (the director's scratch worktree, detached at `main`) is this
  director's. Everything else listed belongs to the Systems director (`sc`,
  `se`, `sf`, `sg`, `sl`, `st`, `su`, `sx`) or the planning agents (`pp`,
  `pcm`, `pco`, `psk`). Kept unmerged on purpose: `atlas-wip`,
  `crunch/style-p2`.

## Left

- **T-251**: slow file-scanning tests time out under load (EngineEventNames
  runs 4.6 s against a 5 s limit). Builder-lite.
- Notes in STATUS ("Notes between directors") for the Systems director: the
  travel determinism flake (fixed on their side, 9efa6db2) and the content
  test failures after the CMS sync (fixed, 4ec24ad0).
- For whoever builds it: no hero dismissal exists (must return held copies or
  refuse on a full Bank); enemies notice flags at the hero reach (240).

## Lessons

- **Two directors share one main folder.** A fast-forward can race the other
  director's commit and leave your files staged on their HEAD: check
  `git status` after every fast-forward; if it happens, restore exactly your
  own files by name to HEAD and redo the merge. `git fetch` and re-check
  `main` right before each fast-forward; take ticket numbers after checking
  every branch.
- **Gate the merged result**; if the merged tree differs from the gated branch
  only in docs, the branch's gate holds.
- **Timing flags under load are noise; the work check decides.** Scanning
  tests also time out under load; rerun them alone before believing them.
- **The drag bench finds real bugs**: run the token kind before and after
  anything that adds a layer over the mat (the work plate took presses).
- **Agents read CLAUDE.md's weekday bench windows literally**; tell them the
  owner's current ruling, or run the benches yourself.
- **Tell agents to kill only their own processes**: one tried to kill every
  Chrome on the PC (refused by the permission layer).
- **Ask which thing the owner means** when a UI piece exists twice (the hero
  bar: horizontal vs the Bank's vertical tabs).
- **Dev-server config inside the worktree, run from it**; own port and
  `cacheDir` per agent; don't grep Vite's coloured log for "Local:".
- **The Mat Tuner stores every row**: a changed tuned default needs its old
  value in `RETIRED_DEFAULTS`.
