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
| P2-3 sprite clock | engineer (left by cut-off) | `crunch/p2-3` → `main` | merged (bench: same work; timing 1.3–1.5× the Oct-7 baseline, identical to `main`'s own control run under today's load) | Tue | Tue |
| P2-6 loot redraws and flight canvas | engineer (left by cut-off) | `crunch/p2-6` → `main` | merged (bench: same work; timing as `main`'s control) | Tue | Tue |
| P2-5 hit-loop layers (spike) | engineer | `crunch/p2-5` → `main` | merged: composited layers 56 → 45 on cap128 at 4× like for like; a worked Token's loop goes in the next eye-check batch | Tue | Tue |
| Atlas batch M1+M2: A6, A10, A3b, A11 | owner | `crunch/preview` → `main` | merged (owner verdict: fine for a first implementation; [archived file](../archive/eyecheck/2026-10-13_atlas-m1-m2.md)) | Tue–Wed | Tue |
| A11 CMS composer patch | owner | `main` | done: the owner's Sync of 10:00 wrote the tool wording; round-trip tests green | Tue | Tue |
| Content re-pin after the owner's rename (Oak Seed → Oak Seedling) | builder-lite | `fix/content-repin` (`repin`) → `main` | merged; one `it.fails` left (the seedling sprite, owner art) | Tue | Tue |
| P2-7 sparse stack order | engineer | `crunch/p2-7` | queued (P2-5 is merged) | Wed | |
| P2-8 tick and React per tick | engineer | `crunch/p2-8` → `main` | merged (bench: same work, timing as `main`'s control; commits per tick 0.79 → 0.57 on S2, renders 6.35 → 3.89; no eye-check) | Tue | Tue |
| P2-9 drags | engineer | `crunch/p2-9` | queued (from a `main` that holds P2-8) | Wed–Thu | |
| Atlas A8 cartographer's tutorial | builder | `crunch/atlas-a8` → `main` | merged Wed morning (owner: lines are placeholders, fine; [archived file](../archive/eyecheck/2026-10-13_atlas-a8.md)) | Tue | Wed |
| Atlas A12 map upcycling | builder | `crunch/atlas-a12` → `main` | merged (owner deferred the look, trusted on the gate; [archived file](../archive/eyecheck/2026-10-13_atlas-a12.md)) | Tue | Tue |
| Regroup: wave 2 order | owner + director | chat | done Wed morning (owner chose: finish brief 60, the P1 bug and ruled tweaks, terrain plan) | Wed | Wed |

## Wave 2 (Wed 14 – Sat 17 October), order ruled by the owner 2026-10-14

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| P2-7 sparse stack order (also the z clamp at 256) | engineer | `crunch/p2-7` (`p2-7`) | ready; director gate pending; bench-queued (boxes rewritten per move 122 → 2 on cap128; 256 board: every Token on its own z, flags no longer cover lower Tokens) | Wed | |
| P2-9 drags | engineer | `crunch/p2-9` (`p2-9`) | ready; director gate running; bench-queued (`bench:drag` before/after; pickup renders −20 to −38 %) | Wed | |
| T-145 Tokens twitch every 20–30 s (P1) | engineer | `fix/t145-twitch` (`t145`) | ready; director gate running; bench-queued (cause: compositor-run mat animations resample the scaled sprites; composited layers on cap128 46 → 14) | Wed | |
| P2-10 minimise stops the frame loop (T-117) | builder | `crunch/p2-10` | queued | Thu | |
| Ruled tweaks: T-147 hover outline, T-148 Hall movable, T-153 gear alert, T-152 drawers, T-158 bubbles | builder-lite, two at a time | `fix/t1xx` each | queued (eye-check: T-147 and T-148 together, one file) | Thu–Fri | |
| T-182 guard test for ids code depends on | builder-lite | `fix/t182-id-guard` | queued | Thu | |
| Brief 80 T0 terrain plan (read-only; owner's spritesheets are ready) | engineer | `crunch/terrain` | queued | Fri | |
| Handoff; T-181 baseline retake queued for Sat 01:00 | director / runner | `main` | queued | Sat | |
| Planning agent briefs this week's concept docs into the queue table | owner + planning | `planning` (`pp`) | in progress alongside (owner's choice) | Wed–Sat | |


## Questions for the owner

*Design questions the director cannot answer, as multiple choice, recommendation
first; the owner answers in the director chat and the answer is recorded where
it belongs.*

1. **Equipping by drop opens the hero sheet inside the drop's own frame** (P2-9
   found it is the heaviest drop: ~240 renders). **A (recommended):** open the
   sheet in a transition one frame after the drop, as brief 60 D3 did for the
   Shop list and the toasts; you would not see the difference. **B:** leave it.
   Not built either way; a builder-lite job once ruled.
2. **Soft drop shadows on the state badges** (recipe gear, warnings, the −1
   number) each take a drawing layer while shown (T-145 found it; no Token
   goes soft from them). **A (recommended):** settle it inside T-013's
   pixel-shadow ruling. **B:** keep them. **C:** swap now for a near-identical
   hard shadow.

## Bench queue (one at a time, weekdays 13:00–17:00 and 01:00–07:00)

1. ~~P2-3, P2-6~~ done 13:00–13:05; `main` control run 13:05 shows the same 1.3–1.5× timing against the Oct-7 baseline (machine load: 13 Chrome, 15 Node processes). **Retake `bench/baseline.json` on a quiet machine** (T-111) before timing verdicts mean anything.
2. ~~P2-5 layer count~~ done 13:45–13:51 (56 → 45).
3. Wed 13:00: `crunch/p2-7` engine bench `--compare`; `crunch/p2-9` engine bench `--compare`; `bench:drag --board=cap128` on `main` then on `crunch/p2-9` (plain and `--cpu=4`); `bench:draw --ab=.claude/worktrees/p27a --only=cap128,cap256` for P2-7.
4. After those: `fix/t145-twitch` engine bench `--compare` and `bench:draw --ab` against `main`, cap128 and S2.
4. ~~P2-8, A8 engine benches~~ done 13:13–13:18, same work both. Still for P2-8: `bench:draw --compare` on `main` for the cost-log line.
5. `main` after the Atlas batch: engine bench `--compare` (expect same work) and the drag bench baseline (`npm run bench:drag`, 5 kinds, A3b) for PERFORMANCE.md.

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

**Tue 2026-10-13, evening.** Where we are: on `main` today the Atlas batch (A6,
A10, A3b, A11), A12, P2-3, P2-5, P2-6, P2-8, the content re-pin after the Oak
Seedling rename, A11's wording in `data/`, and the process docs; suite 4716
green. Next: Wed morning start P2-7 and P2-9 (two engineers); A8 merges when
the owner has read its lines. Owner: read
[eyecheck/2026-10-13_atlas-a8.md](eyecheck/2026-10-13_atlas-a8.md); the CMS
to-dos in NOW.md are not urgent. Budget: a heavy day (five phases, one review
and ~12 gate runs); Wednesday runs lighter with two engineers and no review.
Blockers: the bench baseline (Oct 7) no longer matches the machine's load, so
timing verdicts are noise until it is retaken on a quiet evening (T-111); the
work check and like-for-like controls carry the gate meanwhile.

**Wed 2026-10-14, morning.** Where we are: A8 merged (owner read the lines;
eye-checks are now only for significant look or play changes). Wave 2 ruled:
finish brief 60, the P1 twitch bug and the ruled tweaks, then the terrain plan
Friday. Next: P2-7 and P2-9 started on two engineers; T-145 when a slot frees;
benches at 13:00. Owner: run /planning to brief this week's concept docs into
the queue table; nothing else needed. Budget: three phases planned for today.
Blockers: none.
