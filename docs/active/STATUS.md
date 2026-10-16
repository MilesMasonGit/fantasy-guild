# STATUS — the art pass (brief 85), batch 1

*The director keeps this file; nobody else edits it. One row per phase; a
five-line summary at each batch's edges (proposed, looked at); anything older
than two days is trimmed. States: queued · building · ready (tests, cycles,
build green) · bench-queued · eye-check · merged.*

## Art pass, batch 1 (proposed and ruled 2026-10-15 evening)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Bench baselines retaken on a quiet machine (T-181), engine and draw | director | `main` | engine: done Thu 22:11 (owner asleep, PC quiet), committed. Draw: refused twice (Chrome ran one 4× scene at ~5×, the bench's own guard), saved on the third run Fri 01:00–01:41 and committed | Thu night | Fri |
| The owed 4× drag pair for the placing grid: before (`1f8239b3`) and after (`main`), cap128 | director | `p23b` then `main` | done: Token drags level (median pickup 67/67 ms, carry 36/36, drop 73/73 plain); the grid costs nothing measurable. Both runs had 1–2 flag drags grab a neighbour's flag on the full board, before and after alike (T-187) | Thu night | Thu |
| The owner's art sessions on the bench and the brightness script, here with the director at the owner's pace (owner 2026-10-15); the bake when a preset wins (tag `art-before-vibrancy`, dated zip, art-only commit on `main`) | owner + director | `main` | first pass done 2026-10-16: **Drag 1.15 / 1.25 wins**; the bake waits for the asset reorganisation (owner) | owner's pace | |
| Dev panel's Scatter Loot button names real items (T-184) | builder-lite | `fix/t184-dev-items` → `main` | merged Thu night (gate on the merged result: 4964 tests, cycles, build, work check same) | Thu | Thu |
| Floor loot lands on its spot and draws crisp (T-183) | builder | `fix/t183-loot-offset` → `main` | merged Thu night (same gate; in the game the landed loot measured 40 mat units up-left before, 0 after; the stack slide fixed alongside so piles don't jump; a small look fix, no eye-check) | Thu | Thu |
| Asset names and folders: the ruleset ([ASSET_NAMING.md](../reference/ASSET_NAMING.md), approved 2026-10-16), the rename list (builder, done), then the apply (engineer), then the bake | builder → engineer | `art/asset-rename` (`rn`) | list approved by the owner 2026-10-16 (three rounds of answers on the review page); step 2 built and verified by the director (4995 tests, cycles, build, list and legacy-name checks; the branch build in the game: slot screen, Starter Camp, Bank, Guild Hall with 0 failed pictures; CMS button changes sprite fields only). merged Fri 11:40 (work check same; timing 1.2–1.28× under daytime load, `main`'s control run read the same). Waiting on the owner: CMS Sprite Audit → Apply renames → Sync on `main` | Fri | Fri |
| After the bake: drop the drag filter's brightness and saturation (A4), T-180's material palettes | builder-lite / owner | — | waits for the bake | | |
| Later: Recruits get a weak basic attack (T-167); equip-by-drop opens the sheet a frame later (T-186, ruled 2026-10-15) | — | — | next batches | | |

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
| Terrain T1: the ground plan, pure code | engineer | `crunch/terrain-t1` → `main` | merged (work check same; Forest + Coast plans in ~10 ms) | Thu | Thu |
| Terrain T3: terrain in placement (Tokens that need water or shore land only there; everything else anywhere dry; meadow Regions unchanged) | engineer | `crunch/terrain-t3` → `main` | merged (work check same) | Thu | Thu |
| Terrain T2: the ground drawn on the mat | engineer | `fix/terrain-tm1` → `main` | merged (owner eye-check all fine; benches: layers 26 with and without the ground, draw cost 0.00 ms saved with it off, crisp green; [archived file](../archive/eyecheck/2026-10-15_terrain-ground.md)) | Thu | Thu |
| Terrain T4: the CMS "Stands on" field and the grid while placing | builder | `fix/terrain-tm1` → `main` | merged (owner eye-check all fine; a 4× drag pair still owed) | Thu | Thu |
| The dev server must survive a full sprite redraw (T-185) | engineer | `fix/t185-spritefx-server` → `main` | merged. Cause: the main folder's dev server watched every agent worktree (211k handles, 2 GB) and ran the redraw in its own process; now the worktrees are ignored (6k handles, 165 MB) and the redraw runs in a child process (5 s) | Thu | Thu |
| Art bench page (brief 85 A1) | builder | `crunch/art-a1` → `main` | merged: `npm run art:bench` | Thu | Thu |
| Brightness script with presets and outline protection (brief 85 A2) | builder | `crunch/art-a2` → `main` | merged: `npm run art:brighten` (previews only; the bake refuses without the tag, a dated zip outside the project and a clean assets tree) | Thu | Thu |
| Studio split and palette import (brief 85 A3, T-179) | builder | `crunch/art-a3` → `main` | merged: `npm run studio` on port 5175; the CMS top bar lost the Recolor and Animation tabs; drop palettes into `cms/palettes-inbox/` and Import | Thu | Thu |
| The owner's art weekend (brief 85): tools first, then support | director + one agent | `main` | Fri–Sun; overrides the Saturday stop this weekend only | Fri–Sun | |
| Handoff; T-181 baseline retake queued for Sat 01:00 | director / runner | `main` | queued; moves to Sunday night if the art weekend runs | Sat–Sun | |
| Planning agent briefs this week's concept docs into the queue table | owner + planning | `planning` (`pp`) | in progress alongside (owner's choice) | Wed–Sat | |


## Questions for the owner

*Design questions the director cannot answer, as multiple choice, recommendation
first; asked with the next batch proposal and recorded where they belong.*

None open. (Ruled 2026-10-15: equip-by-drop opens the sheet a frame later,
T-186; the badges' soft shadows are settled inside T-013.)

## Bench queue (one at a time, weekdays 13:00–17:00 and 01:00–07:00, or when the owner says the PC is quiet)

Empty (the rename's work check ran at 11:35 with the owner's go).

## Summaries

**Thu 2026-10-15, closing (wave 2 director).** The whole of wave 2 and the
terrain (brief 80 T0–T4) are on `main`, the owner's eye-checks all fine; the
three art tools for brief 85 are on `main` for the owner's art pass.

**Thu 2026-10-15, evening: art pass batch 1 proposed and ruled.** Where we
are: `main` green (4960 tests), worktrees clean. The batch: baselines and the
owed drag pair tonight at 01:00 on a timer; the owner's art sessions with the
director on call; two small fillers building (dev-panel items, floor loot
offset). Owner: leave the PC on and quiet tonight; work the art bench when you
like. Blockers: none.

**Fri 2026-10-16, night.** Where we are: the floor-loot fix and the dev panel's real items are on `main` (gate on the merged result green, same work); the engine baseline is fresh; the placing grid's drag pair shows no cost. The draw baseline is fresh too (third run, 01:00). Next: the owner's first brightness pass on the bench, which is ready. Owner: open the bench and pick or adjust a preset. Blockers: none.
