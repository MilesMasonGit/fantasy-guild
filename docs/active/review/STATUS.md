# Review round 4: status

*Kept by the reviewer. Next free finding number: **CR4-082**.*

## Sessions

| Session | Area | State | Date | Commit | Summary |
|---|---|---|---|---|---|
| R0 | The map | ready for triage | 2026-11-07 | ea6b9f92 | `R0_the_map.md`: 12 findings (10 cleanup, 1 test, 1 docs; 0 owner-decision). The architecture doc holds; tools at ea6b9f92 match the baselines; the production bundle has no dev code. Top: the GameState rehydration cycle (CR4-001), terrain painters under systems (CR4-003), CMS-only ledger in src (CR4-010). |
| R1 | Tick and time | ready for triage | 2026-11-07 | 08d86ba1 | `R1_tick_and_time.md`: 5 findings (2 bug, 1 owner-decision, 1 perf reasoned P3, 1 cleanup). The best-kept corner of the code; nothing to bench. Top: playtime counts time away (CR4-013), dead sound hooks (CR4-014), live rules on the wall clock (CR4-015). |
| R2 | Board and mat engine | ready for triage | 2026-11-07 | 9d03ffb1 | `R2_board_and_mat_engine.md`: 15 findings (7 perf reasoned, 1 memory, 2 bug, 4 cleanup, 1 docs; 0 owner-decision). Sound engine; the costs are on the tick path. Top: room searches on the tick and a memo wiped by enemy steps (CR4-018), a move onto a copy leaves a zero-charge ghost (CR4-027), per-worked-Token recomputation that the catch-up multiplies (CR4-019/020). Measure first: a CPU profile of the catch-up and of C240 at p99. |
| R3 | Heroes, combat, equipment, progression | ready for triage | 2026-11-07 | b7559216 | `R3_heroes_combat_equipment_progression.md`: 13 findings (3 perf reasoned, 3 bug, 6 cleanup, 1 docs; 0 owner-decision, 1 owner question). Good, with one hot spot and card-era residue. Top: the loadout rebuilt on every per-tick work-time read, so T-078 is hot not latent (CR4-033); the bucket maths written four times with drift (CR4-036); two save fields written on every item gain and read by nothing (CR4-040). |
| R4 | Drawing | ready for triage | 2026-11-07 | 83461380 | `R4_drawing.md`: 15 findings (1 memory measured, 10 perf reasoned, 1 bug, 2 cleanup, 1 docs; 0 owner-decision). Good, much better than round 3 left it. Top: the cause of T-333, one-shot mat effects that only remove themselves when a frame finishes (CR4-046); a document query and layout read on every pointer move (CR4-048); fifteen pollers that never pause and an upkeep badge recomputing the mat per Bank change (CR4-050). Measure first: the soak hidden phase after CR4-046, a pointer-move trace, the ground build marks. |
| R5 | React plumbing | ready for triage | 2026-11-07 | 01830b61 | `R5_react_plumbing.md`: 6 findings (2 perf reasoned, 1 a11y owner-decision, 2 cleanup, 1 docs). Good: every subscription unsubscribes, no store hands React a fresh object, selectors keep the contract. Top: a hero's status recomputed by four stores per walk tick (CR4-061); the root redrawing the whole screen for a hover or a click (CR4-062); drag sources announcing a keyboard drag that cannot happen (CR4-063, owner). Measure first: re-run `bench/tick-commits.mjs`. |
| R6 | State and saves | ready for triage | 2026-11-07 | e16338be | `R6_state_and_saves.md`: 5 findings (1 cleanup, 2 perf reasoned, 1 bug, 1 docs; 0 owner-decision). Good and careful: whole-file writes, a rolling backup, a retry, an undo; the architecture map is exact here. Top: seventeen saved fields nothing reads and a required key for a dead system (CR4-067); the title screen parsing whole saves for five numbers (CR4-068); a save that grows per Region and has never been measured (CR4-069). Measure first: save size and stringify time on the owner's slot. |
| R7 | World, atlas, quests | ready for triage | 2026-11-07 | 18fd3e7f | `R7_world_atlas_quests.md`: 6 findings (2 cleanup, 2 perf reasoned, 1 bug, 1 docs; 0 owner-decision). Good: all seeded, nothing per tick but the quest clock, the map's counts exact. Top: migration code for saves the version check already refuses (CR4-072); settling lays the mat out up to nine times with a whole-field rasterise per candidate pond (CR4-073); the open world map recomputing every cell on every Bank change (CR4-074). Measure first: time `Atlas.settle` and `worldView()`. |
| R8 | Content boundary and CMS layer | ready for triage | 2026-11-07 | 18fd3e7f | `R8_content_boundary_and_cms.md`: 4 findings (2 bug, 1 cleanup, 1 docs; 0 owner-decision). Good: small startup work, one shared copy of nearly every rule, the map exact. Top: the Sync's stale-workspace guard compares ids only and the write is not atomic (CR4-078, P2, the owner's content); a recipe's items are checked nowhere but the CMS page (CR4-079); the Sync's words still promise maps (CR4-081). |
| R9 | Dead code, duplicates, cycles, lint | not started | | | |
| R10 | Tests | not started | | | |
| R11 | Memory and idle | not started (soak baseline taken 2026-11-07: T-333, T-335 are its leads) | | | |
| R12 | Shell, build, startup | not started | | | |

States: `not started`, `reading`, `verifying`, `ready for triage`, `triaged`,
`closed`.

## Findings by state

| open | verified | ticket | moot | owner-no |
|---|---|---|---|---|
| 0 | 81 | 0 | 0 | 0 |

## Baselines (phase 1, director)

| Measure | Taken | Commit | File |
|---|---|---|---|
| engine bench | 2026-11-07 01:00 window | 85cefe1f (3f336e14) | `bench/baseline.json` |
| draw bench and calibration | 2026-11-07 01:00 window | 85cefe1f (3f336e14) | `bench/draw-baseline.json`, `bench/calibration/stamp.json` |
| memory soak, 30 min visible, 5 hidden | 2026-11-07 10:34; heap WARN 52 KB/min visible (T-335), hidden phase FAIL (T-333 confirmed: 294 nodes, 136 listeners a minute) | 44b75a7a | `bench/soak-baseline.json`, `baseline/soak.txt` |
| bundle size (`npm run build`, dist/) | 2026-11-07: one 2.13 MB script, 663 KB gzipped, no code splitting | 44b75a7a | `baseline/bundle.txt` |
| test suite wall time | 2026-11-07, quiet machine, worktree: 632 files, 7,876 tests, 206 s wall (CMS-only files 48 s) | 44b75a7a + d5a5fa9e | `baseline/suite.txt` |
| knip, depcruise, cycles, jscpd, lint | 2026-11-06 (prep) | 93338609 | `baseline/*.txt` |

## Questions for the owner

- **Keyboard drag (CR4-063).** Every hero, flag, Bank item and Shop row is a Tab stop that tells a screen reader it can be lifted with the space bar, and nothing happens when it is. (a) Add keyboard drag for real (a feature: a sensor plus a rule for where a keyboard drop lands on the free mat). (b) Remove the Tab stops and the text; drag sources stay pointer-only (the reviewer's recommendation for now: honest, small, and nothing a mouse player sees). (c) Leave it until a keyboard or screen-reader player asks.

- **"Playtime" on the slot screen** (CR4-013): today it grows while the catch-up plays the time you were away. Should it mean (a) time the game was open, so the catch-up stops adding to it (recommended: that is what the label and the field's comment say), or (b) the guild's whole life including time away, so the label changes and nothing else does?
- **Sounds that never play** (CR4-014): a defeat sound and an "invasion" sound are wired to moments the engine never announces. (a) Wire the defeat sound to a hero's defeat on the mat and decide what "invasion" means now (a settled place's enemies arriving?), or (b) drop both sounds and the dead hooks (recommended if no moment comes to mind: the knockout banner already plays a warning tone).
- **XP bonuses on kills** (CR4-037): a Guild Hall star or an item that adds XP applies to work cycles but never to the XP a kill awards; the hero-side multiplier that was meant to carry it reads a value nothing writes. (a) Kills get the same XP bonuses as work (changes the bench's XP totals), or (b) XP bonuses are for work only, by design, and the dead multiplier is deleted (recommended if that was the intent: the palette's own hint says "XP awarded to the working hero per cycle").
