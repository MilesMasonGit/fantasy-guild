# Review round 4: status

*Kept by the reviewer. Next free finding number: **CR4-001**.*

## Sessions

| Session | Area | State | Date | Commit | Summary |
|---|---|---|---|---|---|
| R0 | The map | not started | | | |
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
| R11 | Memory and idle | not started (needs the soak baseline) | | | |
| R12 | Shell, build, startup | not started | | | |

States: `not started`, `reading`, `verifying`, `ready for triage`, `triaged`,
`closed`.

## Findings by state

| open | verified | ticket | moot | owner-no |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |

## Baselines (phase 1, director)

| Measure | Taken | Commit | File |
|---|---|---|---|
| engine bench | pending (next 01:00 window) | | `bench/baseline.json` |
| draw bench | pending | | `bench/draw-baseline.json` |
| memory soak, 30 min visible, 5 hidden | pending | | `bench/soak-baseline.json` |
| bundle size (`npm run build`, dist/) | pending | | `baseline/bundle.txt` |
| test suite wall time | pending | | `baseline/suite.txt` |
| knip, depcruise, cycles, jscpd, lint | 2026-11-06 (prep) | 93338609 | `baseline/*.txt` |

## Questions for the owner

(none yet)
