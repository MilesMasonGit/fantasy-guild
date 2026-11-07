# Review round 4: status

*Kept by the reviewer. Next free finding number: **CR4-013**.*

## Sessions

| Session | Area | State | Date | Commit | Summary |
|---|---|---|---|---|---|
| R0 | The map | ready for triage | 2026-11-07 | ea6b9f92 | `R0_the_map.md`: 12 findings (10 cleanup, 1 test, 1 docs; 0 owner-decision). The architecture doc holds; tools at ea6b9f92 match the baselines; the production bundle has no dev code. Top: the GameState rehydration cycle (CR4-001), terrain painters under systems (CR4-003), CMS-only ledger in src (CR4-010). |
| R1 | Tick and time | not started | | | |
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
| 0 | 12 | 0 | 0 | 0 |

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

(none yet)
