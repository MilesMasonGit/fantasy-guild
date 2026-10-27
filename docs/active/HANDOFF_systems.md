# HANDOFF — Systems director

*Replaced whole each time. Written 2026-10-27 at the close of the first Systems
director session (2026-10-22 to 27), for a **fresh director** who runs brief
240 K4, the full-game play-through. Read `CLAUDE.md`, this file and `STATUS.md`
(the "Systems director" sections); verify with `git worktree list` and
`git log --oneline -5`.*

## On `main` (pushed; suite green, 6601 tests)

- **Brief 220 combat: complete.** Small fixed numbers (HP 10 + level, weapon
  damage, 5–40 % misses, crits before flat armour, weapon speeds); weapon styles
  and family abilities; enemy kinds; food, elixirs (10 fights) and the "used"
  bubble; Poison, Burn and boss moves in the Rules system; one-on-one fights,
  bosses and guardians from camps of one, ~2 % node ambushes, the Summoning
  Circle; the combat screen (bars "number · %", fight chip, side floats, the
  fight plate, the panel with the battlefield strip and versus card, the log,
  the enemy card, the away summary's Fights block); fight bars drawn above loot.
- **Brief 230 skill loops: complete except the owner's eye-check.** Forestry
  (Stumps, Forests in reach, seedlings), Orchards, Mining (resting veins, Mines
  double ore, Minecarts), Farming (Fields, crops, loads, Herb Gardens, Wells,
  Composters, Beehives, Windmill), Fishing (catch pools, bait, Dock, the Trap),
  per-station recipe pools, work potions and drinks, seeing support effects,
  the 80 % speed-up floor, the 1-XP floor, stations and supports never wear.
- **Brief 240 basic content: complete except K4.** K0 engine gaps (Starter Camp
  in packs, tutorial maps after a copper tool and a goblin, first-kill drops,
  the Bog, Hall prices by plane); the owner reviewed and synced every pack:
  skill loops (47d19bec), pack 1 Starter Camp and plane 1 (72ce473d), pack 2
  plane 2 (cb493683), the balance pack and pack 3 modifiers and caches
  (58d02d01), the boss follow-up (6b63c8e9). Applied packs with every entry's
  note: `cms/incoming/applied/`.
- Tests are seeded per test (T-250, `src/tests/setup/seededRandom.js`).
- Records: `docs/archive/eyecheck/2026-10-2x_combat-*.md`, `…_content-k0.md`.

## Your job: brief 240 K4, the full-game play-through

Spec: `docs/active/briefs/240_basic_content.md` § K4.
1. **A reachability test** (extend `src/tests/NewGameOpening.test.js`, which
   already counts catch pools, tutorial maps and map-placed Tokens): from a new
   game's Starter Camp, every plane-1 and plane-2 material, tool, building and
   the first plane-2 map is reachable through the authored content.
2. **The play-through**: a new game in the running build, through the Starter
   Camp (tutorial: a copper tool and a goblin pay Forest, Mountain, Coast), one
   plane-1 Region, a boss's first kill (a plane-2 map), and the first plane-2
   Region. Headless Chrome screenshots at 1920×1080 for the owner (the browser
   pane is hidden; `bench/browser/cdp.mjs`; the S9 builder's approach is in its
   report summary in `docs/active/eyecheck/2026-10-26_skill-loops-s9.md`). Time
   can be driven with `window.Game.GameLoop.runHandlers(100)` loops and the QA
   panel's speed-up. Note pace (time per stage), anything unreachable or
   confusing, and fight difficulty.
3. Write the eye-check file `docs/active/eyecheck/2026-10-2x_basic-content-k4.md`,
   one check per stage with a Verdict line; the owner plays it too.

Known going in:
- **Three hard poison bosses by the owner's choice** (2026-10-27): Greater
  Slime, Queen Bee, Toxic Frog. Don't "fix" them; report how they feel.
- A Recruit needs food to beat a goblin (level 5); the opening Bank holds 15
  Shrimp.
- Density modifiers on full maps only reshuffle them (accepted).
- Blended Regions run more than ~6 enemies (accepted).

## Waiting on the owner

- Verdicts on the **skill-loops eye-check**
  (`docs/active/eyecheck/2026-10-26_skill-loops-s9.md`) and a ranking of its 14
  rough edges. The owner says UI tweaks will keep coming through development:
  treat the rough edges as a list to rank, not a blocker.

## Owed and open

- **Bench timing baseline** predates combat C1 (fights are longer): retake
  `npm run bench -- --save-baseline` and `npm run bench:draw -- --save-baseline`
  on `main` on a quiet machine, and commit with the date.
- Tickets: T-249 (even first swing after a kill; owner ruled "even start"),
  T-248 (enemy strolls over the mat edge), T-253 (CMS tuning page), T-254 (help-
  is-free leftovers).
- The CMS was served on **port 5147** from this session as a background
  process; it stops when this session closes (start it again with
  `npm --prefix cms run dev -- --port 5147`).

## Worktrees

None of the Systems director's remain. `pp`, `pcm`, `psk`, `pco` (planning) and
`p23b` belong to other sessions.

## Lessons

- **Packs are built in scratch and copied into `cms/incoming/` once**, after
  every check: the owner accepts packs as soon as they appear.
- After every owner Sync: id-diff each data file against the applied pack(s),
  then the full suite; fix content-pinned tests in one pass.
- **Never chain a merge after a test run with `;`**: read the result first.
- Duel harnesses must tick statuses (the game loop's status tick), or poison and
  burn bosses look easy.
- A fresh browser's CMS starts with an empty workspace: Restore from Game first.
- Two directors share ticket numbers: re-read "Next free number" and grep the
  number before filing.
- The terminal panel's shell integration failed here; start servers with
  Bash `run_in_background` instead.
