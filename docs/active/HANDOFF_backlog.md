# HANDOFF — the Backlog director (brief 210)

*The Backlog director's own handoff, replaced whole each time it ends (the
terrain director keeps [HANDOFF.md](HANDOFF.md), the features director
[HANDOFF_features.md](HANDOFF_features.md)). Written 2026-10-23 during the
session that started 22 October evening. Read `CLAUDE.md`, this file and
`STATUS.md`, then verify with `git worktree list` and
`git log --oneline -5` before trusting anything here.*

## The owner this week

Away from the PC 23–25 October, on the phone. Rulings 2026-10-22: **looks by
phone screenshots, the owner's ok merges** (hands-on checks listed for their
return); **benches may run any time while they are away** (one at a time,
never beside a build or another agent's Chrome); design questions any time.

## On `main` (pushed)

Brief 210, all okayed by phone, each gated (tests, cycles, build, engine
work check; draw and drag benches where they apply):

- **Batch A** (cd9d2f2c): mat 12 × 6.5 = 1920 × 1040 (load and travel pull
  Tokens inside; bench boards pin their own 11 × 0.64 mat; a stored dev-tuner
  11 is retired); top bar 76 px on the Region banner at 2×, name at display
  size, as wide as the mat; flag reach 240 with a one-pixel gold ring; hitbox
  90 % (WORK CHANGED accepted under T-215+T-216 in `bench/baseline.json`).
  Eye-check record: `docs/archive/eyecheck/2026-10-23_backlog-A.md` (with the
  owner's hands-on list for their return).
- **Batch B** (b0528da0): names under Tokens and heroes; no movable ring, no
  quest glow, tutorial beacon overlay removed; forbidden-only drag tint; five
  loot effects off in `src/ui/utils/lootEffects.js`; pickups fly from where
  they stand (`DndKit.jsx` `measureDragSource`).
- **Batch C so far**: item tiles (515d7154: Bank inspect pane out, header
  search, full tooltip, tints by `type` with a UI_STYLE rule, slot-kind
  placeholders on the art list); one item, one hero (d66c1ee8: copies move
  out of the Bank on equip, full-Bank and in-use refusals, hand-over between
  heroes, old saves settled at load; QA panel Gear section); "New!" clears on
  hover or pin (eb6c459b).
- Cost log (PERFORMANCE): A and B draw no dearer, loot 4× 48 → 59 fps.

## Branches and worktrees

- `ch` (`backlog/hero-bar`): C2 building (hero bar portrait + name, shine on
  equip, Work Permissions button and drawer). Check its `STATUS.md`.
- `p23b`: the director's scratch worktree, detached; combined merges are made
  here, then `main` fast-forwards to them.
- `pp`, `pcm`, `pco`, `psk`: the planning agents' (not this director's).
- Kept unmerged on purpose: `atlas-wip` (the owner's parked Atlas work),
  `crunch/style-p2` (dropped shadows, a record). 134 merged branches were
  deleted with the owner's leave on 22 Oct.

## Next

1. C2's phone look, merge, close batch C (eye-check record like A's).
2. **Batch D, the Guild Hall upgrade screen** (brief 210 D1, D2): calmer sky,
   grey/blue/gold stars (art exists in `public/assets/playmat/screens/`),
   effects popover, the camera glide back (tag `atlas-camera-move`).
3. Batch E (drawers, the Atlas spread, dev tools tidy; E3 after A3 is free
   now), then F (pixel frames on every window, the hero-to-Token bubble row,
   mock-ups first).

## Owed and open

- T-240: the drag bench skips its Shop and Bank kinds (on `main` too).
- For combat planning: enemies notice flags at the hero reach (240); owner
  "fine for now".
- No hero dismissal exists; whoever builds it must return held copies or
  refuse on a full Bank.
- The draw bench boards pin the old mat; measuring the bigger on-screen mat
  needs its own run if wanted.

## Lessons

- **Timing flags under load are noise; the work check decides.** Every
  engine bench run beside an agent (or straight after a suite) read p99s
  ×1.2–1.4; the same code on a quiet machine read clean. Gate the combined
  merge with nothing else running.
- **Grep for "Local:" fails on Vite's coloured log**; wait on the port or
  strip colour codes, or the capture never starts.
- **A dev-server config must live inside the worktree** (Vite resolves
  `vite` from the config's folder) and run from it (Tailwind needs the
  project as the working folder). Each agent: own port, own `cacheDir`.
- **The Mat Tuner stores every row**: change a tuned default and add the old
  value to `RETIRED_DEFAULTS` in `matTuning.js`, or the owner's PC keeps it.
- A shared `suite.lock` file let two agents and the director take turns at
  the suite, builds and benches without clashing.
