# HANDOFF — the Backlog director (brief 210)

*The Backlog director's own handoff, replaced whole each time it ends (the
terrain director keeps [HANDOFF.md](HANDOFF.md), the features director
[HANDOFF_features.md](HANDOFF_features.md); the Systems director, building
combat (brief 220), shares STATUS.md and the PC). Written 2026-10-24 evening.
Read `CLAUDE.md`, this file and `STATUS.md`, then verify with
`git worktree list` and `git log --oneline -5` before trusting anything here.*

## The owner this week

Away from the PC until about 25 October, on the phone. Rulings 2026-10-22:
**looks by phone screenshots, the owner's ok merges** (hands-on checks for
their return are in the eye-check records); **benches may run any time while
they are away**, one heavy run at a time across both directors (the shared
`.claude/worktrees/suite.lock` file); design questions any time.

## Brief 210 is complete (main eb969849)

All six batches merged, each phase okayed by phone and gated (tests, cycles,
build, engine work check; draw and drag benches where they apply). Records:
`docs/archive/eyecheck/2026-10-23_backlog-A.md` and `2026-10-23_backlog-BC.md`
(B, C, D). E and F were okayed by phone too (drawers, Atlas spread, dev tools;
pixel frames round one, the work plate); their "when you're back" checks:
open the Bank (smooth slide), the Atlas Regions spread (select, Travel), a
worked Token's plate (hover opens the full line). Cost lines in PERFORMANCE
("UI rework cost log"): A–F draw no dearer; loot and the work plate cheaper.

## In flight

- `gf` (`backlog/pixel-frames-2`): **T-242**, builder: the owner's second
  audit (tiles, slots, buttons, toggles, rows; the Bank's item tiles still
  have soft borders), then reframe; stops and proposes a split if too big.
- `gb` (`backlog/drag-bench-kinds`): **T-240**, builder: the drag bench's Shop
  and Bank kinds skip on `main`; harness-only fix, full drag bench at the end.
- `p23b`: the director's scratch worktree (combined merges are made here,
  then `main` fast-forwards). The Systems director has its own worktrees
  (`sc`, `sg`, `su`, ...); planning agents `pp`, `pcm`, `pco`, `psk`.
  Kept unmerged on purpose: `atlas-wip`, `crunch/style-p2`.

## Next

1. T-242's phone look and merge; T-240's gate and merge (no look).
2. Small tickets left: T-241 (loot particles over an open Bank), T-243
   (callouts and speech in the pixel family, after the plate), T-244 (nav
   orbs' hover glow), T-247 (a station's gear tip under the work plate).
3. Notes for others: enemies notice flags at the hero reach (240); no hero
   dismissal exists (must return held copies or refuse on a full Bank);
   research capture scripts that clicked the removed Terrain QA section are
   stale; charge changes with no hero at work are silent now (owner: fine).

## Lessons

- **Timing flags under load are noise; the work check decides.** Gate the
  combined merge with nothing else running; a quiet run is clean.
- **Gate the merged result** whenever `main` gained code since the branch
  started; if the merged tree differs from the gated branch only in docs, the
  branch's gate holds.
- **`main` moves under you** now that two directors merge: re-check
  `git log` before every fast-forward and take ticket numbers after checking
  every branch (T-245/T-246 were taken by others).
- **Combine branches that share a screen in the scratch worktree** and let
  the builder who knows the screen resolve conflicts.
- **Ask which thing the owner means** when a wish names a UI piece that
  exists twice (the hero bar: horizontal vs the Bank's vertical tabs).
- **Agents read CLAUDE.md's bench windows literally**; tell them the owner's
  current ruling in the dispatch, or run the bench yourself.
- **Dev-server config inside the worktree, run from it** (Vite resolves from
  the config's folder; Tailwind needs the project as working folder); own
  port and `cacheDir` per agent. Don't grep Vite's coloured log for "Local:".
- **The Mat Tuner stores every row**: change a tuned default → add the old
  value to `RETIRED_DEFAULTS` in `matTuning.js`.
- A shell sitting inside a worktree folder keeps it locked after
  `git worktree remove`; remove the leftover folder later.
