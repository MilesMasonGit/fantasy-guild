# STATUS — wave 1, finishing

*The director keeps this file; nobody else edits it. One row per phase; a
five-line summary at about 07:00 and 22:00 Vancouver time; anything older
than two days is trimmed. States: queued · building · ready (tests, cycles,
build green) · bench-queued · eye-check · merged. Days are Tue 13 to Sat 17
October 2026.*

## Phases

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Process review and docs | director | `chore/process-review` | merged | Tue | Tue |
| P2-3 sprite clock | engineer (left by cut-off) | `crunch/p2-3` (`p2-3`) | bench-queued | Tue | |
| P2-6 loot redraws and flight canvas | engineer (left by cut-off) | `crunch/p2-6` (`p2-6`) | bench-queued | Tue | |
| P2-5 hit-loop layers (spike) | engineer | `crunch/p2-5` (`p2-5`) | bench-queued (layer count and pixel diff still to measure) | Tue–Wed | |
| Atlas batch M1+M2: A6, A10, A3b, A11 | owner | `crunch/preview` → `main` | merged (owner verdict: fine for a first implementation; [archived file](../archive/eyecheck/2026-10-13_atlas-m1-m2.md)) | Tue–Wed | Tue |
| A11 CMS composer patch | owner | `fix/a11-cms-composer` | waiting: the owner's Sync of 10:00 ran on `main` with the old composer; one Sync on this branch is still needed, then it merges | Tue–Wed | |
| P2-7 sparse stack order | engineer | `crunch/p2-7` | queued (after P2-5 merges: both touch stacking) | Wed–Thu | |
| P2-8 tick and React per tick | engineer | `crunch/p2-8` (`p2-8`) | building (started Tue 10:00) | Tue–Wed | |
| P2-9 drags | engineer | `crunch/p2-9` | queued | Thu–Fri | |
| Atlas A8 cartographer's tutorial | builder | `crunch/atlas-a8` | queued (T-144 beacon) | Thu–Fri | |
| Atlas A12 map upcycling | builder | `crunch/atlas-a12` (`atlas-a12`) | eye-check ([file](eyecheck/2026-10-13_atlas-a12.md)); director gate running | Tue | |
| Regroup: planning docs, wave 2 plan | owner + planning | `planning` (`pp`) | queued | Sat–Mon | |

## Bench queue (one at a time, weekdays 13:00–17:00 and 01:00–07:00)

1. `crunch/p2-3` engine bench `--compare` (expect same work).
2. `crunch/p2-6` engine bench `--compare`; `bench:draw --compare` for the cost log.
3. `crunch/p2-5` `bench:profile` layer count and a pixel diff of a worked Token.
4. `main` after the Atlas batch: engine bench `--compare` (expect same work) and the drag bench baseline (`npm run bench:drag`, 5 kinds, A3b) for PERFORMANCE.md.

## Summaries

**Tue 2026-10-13, morning.** Where we are: process decisions recorded in
CLAUDE.md, TESTING.md and the tier files; the owner's folder is back on
`main`; P2-3, P2-6 and P2-5 verified green on tests and committed on their
branches. Next: benches from 13:00, then merge P2-3 and P2-6; the Atlas
eye-check file is ready for the owner's notes. Owner: look at the Atlas batch
and give the preview notes; apply the A11 patch and Sync on its branch; CMS
to-dos in NOW.md. Budget: one review agent and one director session so far
today, well under the day's share. Blockers: none.

**Tue 2026-10-13, midday.** The owner eye-checked the Atlas batch (fine for a
first implementation) and it merged; the A11 CMS composer patch waits on
`fix/a11-cms-composer` for your Sync (the round-trip tests are red until
the Sync writes the new wording). Your folder is on `main`. P2-8 is building. Benches from 13:00. Next:
merge P2-3 and P2-6 after their benches, then P2-7 and P2-9, A8 and A12.
