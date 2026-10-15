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
| P2-7 sparse stack order (also the z clamp at 256) | engineer | `crunch/p2-7` → `main` | merged (engine bench same work; boxes rewritten per move 122 → 2 on cap128; on a 256 board every Token keeps its own z, so flags no longer cover lower Tokens: a look fix you will notice, no eye-check) | Wed | Wed |
| P2-9 drags | engineer | `crunch/p2-9` → `main` | merged (engine bench same work; drag bench level with `main` at 1× and 4× once run order was swapped; pickup renders −20 to −38 %; drags feel the same by design) | Wed | Wed |
| T-145 Tokens twitch every 20–30 s (P1) | engineer | `fix/t145-twitch` → `main` | merged: the guard per animation plus hidden name labels; Tokens pixel-identical while every animation plays; frame work level with `main` at 1× and 4× cap128, 4× in-budget share 66 → 76 %; cost 1× fps 164 → 150 on a 165 Hz screen (director's call, not visible). Possible later spike: heroes and rings off the shared repaint to win those frames back | Wed | Wed |
| Drawing pauses while the app is minimised (P2-10, T-117) | builder | `crunch/p2-10` → `main` | merged (work check same; brief 60's P2 slices are all done). Owner check: minimise the real desktop app once and see the frame counter stop (the Rust side compiles but has not run there) | Wed | Wed |
| Drawers close each other (T-152) | builder-lite | `fix/t152-drawers` → `main` | merged (one hook, one new test; ruled in words, no eye-check) | Wed | Wed |
| Hover outline + Guild Hall movable again (T-147, T-148, with the outline-clipping fix T-146) | builder | `fix/hover-and-hall` → `main` | merged (owner eye-check all fine; [archived file](../archive/eyecheck/2026-10-14_hover-hall-gear.md)) | Wed | Wed |
| Overlapping speech bubbles (T-158) | builder | `fix/t158-bubbles` → `main` | merged Thu 01:10 (night work check same work): a Token's pop-up callout now sits directly above its working hero's speech in one column instead of covering it | Wed | Thu |
| Gear alert stops pulsing (T-153) | builder-lite | `fix/t153-gear-alert` → `main` (via the hover branch) | merged (owner eye-check all fine) | Wed | Wed |
| Safety net for CMS renames (T-182) | builder-lite | `fix/t182-id-guard` → `main` | merged (250 ids checked; T-184 filed for three dead ids on a dev-panel button) | Wed | Wed |
| Terrain plan (brief 80 T0) | engineer | `crunch/terrain` → `main` | done: [terrain_roadmap.md](terrain_roadmap.md), the owner answered all five questions the same evening (no clearing, the ground is static); slices T1 ground plan and T3 placement can start in parallel, T2 the drawn ground after T1, T4 the CMS field and grid after T2 and T3 | Wed | Wed |
| Terrain T1: the ground plan, pure code (what each Region's cells become as pixels; no look yet) | engineer | `crunch/terrain-t1` (`t1`) | ready; director gate green (4802); Forest + Coast plans in ~10 ms warm against a 60 ms bar; work check at 13:00, then merge | Thu | |
| Terrain T3: terrain in placement (Tokens that need water or shore land only there; everything else anywhere dry; meadow Regions unchanged) | engineer | `crunch/terrain-t3` (`t3`) | ready; director gate green (4847); work check at 13:00, then merge | Thu | |
| Terrain T2: the ground drawn on the mat | engineer | `crunch/terrain-t2` (`t2`) | ready; director gate green (4838); combined eye-check branch `fix/terrain-tm1` (T2 + T3) being gated; eye-check file drafted ([file](eyecheck/2026-10-15_terrain-ground.md)); after the 13:00 window: merge T1 and T3, bring `main` into T2, layer count and draw bench on/off, then the handover | Thu | |
| Terrain T4: the CMS "Stands on" field and the grid while placing | builder | `crunch/terrain-t4` (`t4`) | ready; director gate green (4908); on the eye-check branch `fix/terrain-tm1` with the ground | Thu | |
| The dev server must survive a full sprite redraw (T-185) | engineer | `fix/t185-spritefx-server` (`t185`) | ready; director gate green (4810). Cause: the main folder's dev server watched every agent worktree (211k handles, 2 GB) and ran the redraw in its own process; now the worktrees are ignored (6k handles, 165 MB) and the redraw runs in a child process (5 s). Work check at 13:00, then merge | Thu | |
| Art bench page (brief 85 A1: presets side by side on a sample scene, ground, scatter, tint) | builder | `crunch/art-a1` (`a1`) | building (started Thu 11:30; owner ruling via the planning agent: the three art tools ready by Friday) | Thu–Fri | |
| Brightness script with presets and outline protection (brief 85 A2) | builder | `crunch/art-a2` (`a2`) | building (started Thu 11:30) | Thu–Fri | |
| Studio split and palette import (brief 85 A3, T-179) | builder | `crunch/art-a3` | queued (when a slot frees) | Thu–Fri | |
| The owner's art weekend (brief 85): tools first, then support | director + one agent | `main` | Fri–Sun; overrides the Saturday stop this weekend only | Fri–Sun | |
| Handoff; T-181 baseline retake queued for Sat 01:00 | director / runner | `main` | queued; moves to Sunday night if the art weekend runs | Sat–Sun | |
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
5. ~~Thu 01:00 work checks~~ done: drawing-pause, hover, bubbles all same work; on the quiet machine the engine run reads 1.06× the Oct-7 baseline (yesterday's 1.3× was load).
4. ~~P2-7, P2-9 engine and drag benches~~ done 13:00–14:14. ~~T-145 engine bench and draw A/B~~ done 14:17–14:35 (engine same work; draw A/B: too costly, sent back). The engineer benches alone until it reports. Still owed to the cost log: P2-7's draw A/B against its snapshot `p27a` (needs the snapshot's perf build served on a port; `--ab` takes a URL).
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

**Wed 2026-10-14, evening.** Where we are: merged today the stack order fix,
the drag redraw savings, the twitch fix (Tokens stay crisp), the cartographer's
tutorial, the CMS-rename safety net and drawers that close each other; suite
4772 green. Drawing-pause merged at 16:30, which closes brief 60's P2 slices.
Building overnight: the hover outline with the Guild Hall movable again (one
eye-check), and overlapping speech bubbles. Next: the gear alert stops
pulsing, then Friday's terrain plan. Owner: nothing needed tonight; when you
next run the desktop app, minimise it once and see the frame counter stop.
Blockers: none. Process: no daily phase count (parallelism is the limit),
benches by purpose, the director reports in plain words.

**Thu 2026-10-15, morning.** Where we are: everything from the wave 2 table is
merged (brief 60's P2 slices complete; the twitch, tutorial, safety net,
drawers, hover outline, movable Hall, gear alert and speech-bubble fixes), and
the terrain plan is on `main` with the owner's five answers. Next: on the
owner's word, the first two terrain slices in parallel (the ground plan, pure
code; terrain-aware placement), then the drawn ground (an eye-check), then the
CMS "Stands on" field and the placing grid (an eye-check). Owner: say go on
the terrain slices; minimise the desktop app once to check the frame counter
stops. Budget: two slots free. Blockers: none. Saturday: handoff and the
quiet-machine baseline retake.

**Thu 2026-10-15, midday.** Where we are: all four terrain slices are built and
gated (the planning agent's brief 85 assumes terrain moved to the next wave; it
did not: the ground plan, placement, the drawn ground and the CMS field are
ready and wait on the 13:00 work checks, the ground's benches and the owner's
look). The dev-server fix is ready. Brief 85's A1 and A2 started at the
owner's ruling relayed by the planning agent; A3 follows. Next: 13:00
merges, the terrain handover, then the art tools by Friday. Owner: nothing
until the terrain handover. Blockers: none.
