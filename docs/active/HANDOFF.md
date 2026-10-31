# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-10-30 late by
the director session of 29–30 October (kept current; the owner says when the
session hands off). Read `CLAUDE.md`, this file and `STATUS.md`, then verify
with `git worktree list` and `git log --oneline -5`.*

## On `main` (pushed)

Briefs 260, 270, 310, 290 L1–L7 (ledger incl. rate calculator, timeline,
gate), the small-tickets pass (UI: T-267, T-254, T-274, T-204, T-210, T-208,
T-255; T-275, T-278; T-276 river crash). Bench baseline accepted under
`brief270-K1`.

## Tonight's bench chain (this session's timers; logs in its scratchpad)

01:00 `bench:draw --compare` on `main` (p23b) → engine tickets (`l1`,
`fix/engine-tickets`: T-266, T-273, T-265, T-248, T-277; predicted WORK CHANGED
on S2, S3, S5, S6, S8*, same on S1, S4, S7; accept under
`T-266-T-273-T-265-T-248` (+T-277) and merge if it matches) → Hall H1 (`h1`,
+ `bench:calibrate`; same work expected) → world W1 (`w1`; same work; merge on
the gate) → world W2 (`w2`; same work). **If the timers died**, run them by
hand in a window, in that order.

## Waiting for the owner's looks (eye-check files in `docs/active/eyecheck/`)

| Look | Branch (worktree) | Notes |
|---|---|---|
| Encyclopedia (300) | `feat/encyclopedia` (`k4`) | work same; small merge with T-275's `LeaveMatControl` move |
| Combat v2 parts 1–3 (280) | `feat/combat-v3` (`c1`); `feat/combat-v5` (`c2`) adds V5's GDD | each same work; V4 dropped |
| Guild Hall part 1 (320 H1) | `feat/hall-h1` (`h1`) | H2 `feat/hall-h2` and H3 `feat/hall-h3` (`b1`) stack on it; H2's CHANGELOG entry is duplicated |
| World map W1+W2 (330) | `feat/world-w2` (`w2`, holds W1) | merge H1 before W2 (4 small conflicts) |

Merge each: `main` merged in, gate, ff, push. Combat with `feat/combat-v3`
and H1 have small conflicts (render golden: regenerate).

## Packs (accept in order; copies in the scratchpad)

1. Ledger first-fill (main inbox; passes the gate now). 2. Ledger fix pack
(main inbox). 3. Example perks (main inbox). 4. Combat content (scratchpad
`v5/`; after combat merges, re-stamp with `v5/mkpack.mjs --from` the owner's
workspace). 5. Hall star list (scratchpad `h3pack/`, priced on data/ + 1 + 2;
after H1+H2 merge). After each Sync: id-diff every data file.

## Next

- World W3 (writing a cell's mat, Stone terrain, darkened arrival, tutorial
  ending), W4 (node-building rules), W5 (ledger World plan, checks F), W6
  (world pack). Ledger L9 (automatic balancing). Tickets T-270, T-249 (after
  combat merges), T-279, T-280, perf T-197–T-202.

## Lessons

- Two timers fired at once after a crash; chain benches by waiting on the
  previous log's EXIT line.
- Planning rewrites briefs mid-build; re-read from `main`.
- Packs that share records: fixed order, stamp later ones on earlier ones.
- An agent emptied a test save on its own port; agents must back up to
  sessionStorage and never empty a slot.
- The owner calls the handoff (memory); content specifics are the director's.
