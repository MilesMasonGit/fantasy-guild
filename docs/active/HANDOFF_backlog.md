# HANDOFF — the Backlog director (brief 210)

*The Backlog director's own handoff, replaced whole each time it ends (the
terrain director keeps [HANDOFF.md](HANDOFF.md), the features director
[HANDOFF_features.md](HANDOFF_features.md)). Written 2026-10-24 during the
session that started 22 October evening. Read `CLAUDE.md`, this file and
`STATUS.md`, then verify with `git worktree list` and
`git log --oneline -5` before trusting anything here.*

## The owner this week

Away from the PC 23–25 October, on the phone. Rulings 2026-10-22: **looks by
phone screenshots, the owner's ok merges** (hands-on checks listed for their
return in the eye-check records); **benches may run any time while they are
away** (one at a time, never beside a build or another agent's Chrome);
design questions any time.

## On `main` (pushed, 56136a65 plus docs)

Brief 210 batches **A to E are done**, every phase okayed by phone and gated
(tests, cycles, build, engine work check; draw and drag benches where they
apply). Records: `docs/archive/eyecheck/2026-10-23_backlog-A.md` and
`2026-10-23_backlog-BC.md` (B, C and D, each with a "when you're back at the
PC" list). Cost lines in PERFORMANCE ("UI rework cost log").

- **A**: mat 12 × 6.5 (1920 × 1040); top bar on the Region banner; flag reach
  240 with a gold ring; hitbox 90 % (WORK CHANGED accepted, T-215+T-216).
- **B**: names under Tokens and heroes; quieter mat; forbidden-only drag
  tint; five loot effects off (`lootEffects.js`); pickups fly from where they
  stand.
- **C**: item tiles (tooltip, tints, slot marks); one item, one hero; "New!"
  clears; the Bank's **vertical** hero tabs show portrait + name (round 1
  changed the wrong bar; the horizontal bar is as before); equip shine; Work
  Permissions button and drawer.
- **D**: calmer Hall sky; Effects popover; pixel Inspect panel; the camera
  glide (`HallCamera.jsx`).
- **E**: drawers to the left edge with the smooth Bank opening; the Atlas's
  Regions as a two-page spread; dev tools tidied (Mat dials in one QA
  section).

## In flight (batch F, the last)

- `ff` (`backlog/pixel-frames`): F1, T-136, builder: audit every window first
  (`docs/active/research/pixel_frames/audit.md`), then reframe; told to stop
  after the audit and tooltips and propose a split if it is too big.
- `fb` (`backlog/bubble-row`): F2, T-239, engineer: **mock-ups only** on the
  style sheet page, then stop; the owner picks one by phone; then build it and
  measure before and after (bubbles are the biggest per-hero draw cost).
- `p23b`: the director's scratch worktree (combined merges are made here,
  then `main` fast-forwards to them).
- `pp`, `pcm`, `pco`, `psk`: the planning agents'. Kept unmerged on purpose:
  `atlas-wip`, `crunch/style-p2`.

## Next

1. F1's phone look; merge; F2's mock-up pick, build, look, merge. Then brief
   210 is done: close it in `docs/active/briefs/README.md`, archive the
   eye-check record, one `bench:draw --compare` on `main` for the cost log.
2. Tickets found on the way: **T-240** (the drag bench skips its Shop and Bank
   kinds; E1's drawers changed exactly those drags, hand-checked only),
   **T-241** (loot particles draw over an open Bank).
3. For other agents: enemies notice flags at the hero reach (240; combat
   planning); no hero dismissal exists (whoever builds it must return held
   copies or refuse on a full Bank); research capture scripts that clicked the
   removed Terrain QA section are stale.

## Lessons

- **Timing flags under load are noise; the work check decides.** Engine bench
  p99s read ×1.2–1.4 beside any agent or straight after a suite; the same code
  on a quiet machine is clean. Gate the combined merge with nothing running.
- **Gate the merged result**, not just the branch, whenever `main` gained code
  since the branch started (the hero tabs merge carried the "New!" fix).
- **Combine branches that share a screen in the scratch worktree** and let the
  builder who knows the screen resolve conflicts (the Hall panels builder
  merged the glide in cleanly).
- **Ask which thing the owner means** when a wish names a UI piece that
  exists twice (the hero bar: horizontal vs the Bank's vertical tabs).
- **Dev-server config inside the worktree, run from it** (Vite resolves from
  the config's folder; Tailwind needs the project as working folder); own port
  and `cacheDir` per agent. Don't grep Vite's coloured log for "Local:".
- **The Mat Tuner stores every row**: change a tuned default → add the old
  value to `RETIRED_DEFAULTS` in `matTuning.js`.
- **A shared `suite.lock` file** let two agents and the director take turns at
  the suite, builds and benches.
- A shell sitting inside a worktree folder keeps it locked after
  `git worktree remove`; remove the leftover folder later.
