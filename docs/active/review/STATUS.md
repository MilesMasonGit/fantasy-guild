# Review round 4: status

*Kept by the reviewer. Next free finding number: **CR4-018**.*

## Sessions

| Session | Area | State | Date | Commit | Summary |
|---|---|---|---|---|---|
| R0 | The map | ready for triage | 2026-11-07 | ea6b9f92 | `R0_the_map.md`: 12 findings (10 cleanup, 1 test, 1 docs; 0 owner-decision). The architecture doc holds; tools at ea6b9f92 match the baselines; the production bundle has no dev code. Top: the GameState rehydration cycle (CR4-001), terrain painters under systems (CR4-003), CMS-only ledger in src (CR4-010). |
| R1 | Tick and time | ready for triage | 2026-11-07 | 08d86ba1 | `R1_tick_and_time.md`: 5 findings (2 bug, 1 owner-decision, 1 perf reasoned P3, 1 cleanup). The best-kept corner of the code; nothing to bench. Top: playtime counts time away (CR4-013), dead sound hooks (CR4-014), live rules on the wall clock (CR4-015). |
| R2 | Board and mat engine | not started | | | |
| R3 | Heroes, combat, equipment, progression | not started | | | |
| R4 | Drawing | not started | | | |
| R5 | React plumbing | not started | | | |
| R6 | State and saves | not started | | | |
| R7 | World, atlas, quests | not started | | | |
| R8 | Content boundary and CMS layer | not started | | | |
| R9 | Dead code, duplicates, cycles, lint | not started | | | |
| R10 | Tests | not started | | | |
| R11 | Memory and idle | not started (soak baseline taken 2026-11-07: T-333, T-335 are its leads) | | | |
| R12 | Shell, build, startup | not started | | | |

States: `not started`, `reading`, `verifying`, `ready for triage`, `triaged`,
`closed`.

## Findings by state

| open | verified | ticket | moot | owner-no |
|---|---|---|---|---|
| 0 | 17 | 0 | 0 | 0 |

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

- **"Playtime" on the slot screen** (CR4-013): today it grows while the catch-up plays the time you were away. Should it mean (a) time the game was open, so the catch-up stops adding to it (recommended: that is what the label and the field's comment say), or (b) the guild's whole life including time away, so the label changes and nothing else does?
- **Sounds that never play** (CR4-014): a defeat sound and an "invasion" sound are wired to moments the engine never announces. (a) Wire the defeat sound to a hero's defeat on the mat and decide what "invasion" means now (a settled place's enemies arriving?), or (b) drop both sounds and the dead hooks (recommended if no moment comes to mind: the knockout banner already plays a warning tone).
