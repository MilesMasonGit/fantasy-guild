# STATUS — the art pass (brief 85), batch 1

*The director keeps this file; nobody else edits it. One row per phase; a
five-line summary at each batch's edges (proposed, looked at); anything older
than two days is trimmed. States: queued · building · ready (tests, cycles,
build green) · bench-queued · eye-check · merged.*

## Features director, batch 1: the style kit (ruled 2026-10-17)

*The second director (owner, 2026-10-17) works the main queue; the terrain
director keeps the rows below. One code agent at a time here while terrain
runs one, so the PC holds two.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Brief 100 K1: the style sheet page, every standard UI piece live (T-159) | builder | `crunch/style-kit` (`k1`) | eye-check (ca5bf7ff; director's gate: 5106 tests, cycles, build) | Sat | |
| Brief 100 K2: one shared arrow-bar scroll list (T-160) | builder | `crunch/style-kit` (`k1`) | eye-check (14474430; director's gate: 5113 tests, cycles, build). Arrows now dim instead of hiding on the inspect column, pop-up and rank list (UI_STYLE); four look questions for the eye-check | Sat | Sat |
| Brief 100 K3: three text sizes and the shared tooltip (T-161, T-038, T-030) | builder (tooltip spans several files) | `crunch/style-kit` (`k1`) | eye-check (7060a37f; director's gate on the whole kit: 5126 tests, cycles, build). Sizes 18/16/14, display 32 proposed; tooltip on the Bank, Shop and hero panel | Sat | Sat |
| Recruits get a weak basic attack so the tutorial's fight can be won (T-167); owner authors a safe enemy in the Starter Camp afterwards | builder | `fix/t167-recruit-attack` | eye-check (6790962d, with the QA Hire button making roster room; director's gate: 5109 tests, cycles, build; director saw a fresh Recruit beat a Goblin in ~10 s on 5197: Bones on the mat, skills unchanged, the hostile Goblin hit first). Bench-queued (work check; builder expects same) | Sat | |

## Features director, batch 3: map tools (owner 2026-10-17: keep going with the larger implementations; fine refinements later)

*Owner's look so far (2026-10-17, late): the style sheet looks good; the shine
needs work (T-191, later); the Goblin fight doesn't start for the owner (being
diagnosed). The eye-check's eight questions stand at the recommendations
until the owner says otherwise in the refinement pass. Built on
`crunch/hero-bar`; merges after it.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Recruit's Goblin fight doesn't start in the owner's play (T-167 follow-up) | engineer | `fix/t167-recruit-attack` (`t167`) | diagnosing | Sat | |
| Brief 110 M1: Starter Camp Tokens become fixtures (T-165); one call in `atlas/StarterCamp.js`, logic in board code (terrain director's folder) | engineer | `crunch/map-tools` (`mt`) | ready (8d9c7e25; two lines in `StarterCamp.js`, logic in `FixedTokens`/`BoardState`/`Demolition`/`Placement`; also fixed the dev layout tool, which never lifted Tokens already on the mat; director's gate: 5188 tests, cycles, build). Two small owner questions left at the recommendations (a camp Foundation built on keeps the mark; the refusal wording) | Sat | Sun |
| Brief 110 M2: Demolish mode beside Disallow mode (T-166) | builder | `crunch/map-tools` (`mt`) | building | Sun | |
| Brief 110 M3: top bar restyle (T-170) | builder | `crunch/map-tools` | queued, after M2 | | |

## Features director, batch 2: the hero bar (owner 2026-10-17: proceed while the kit's eye-check waits a few hours)

*Built on `crunch/style-kit` plus `fix/t167-recruit-attack` (merged into the
branch), so it uses the kit and everyone fights; it merges after both.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Brief 140 H1: Work Permissions drawer and launcher, one Combat column, purpose tooltips (T-164, T-156) | builder | `crunch/hero-bar` (`hb`) | ready (fe9d17c5; director's gate: 5150 tests, cycles, build; Fight priority proved by a test; drawer seen in screenshots). Eye-check with the bar | Sat | Sat |
| Brief 140 H2: the level-up moment (T-177, T-149) | builder | `crunch/hero-bar` (`hb`) | ready (32a39376; director's gate: 5160 tests, cycles, build; floats seen in screenshots). Draw compare queued for the cost log | Sat | Sat |
| Work Permissions cells square (owner 2026-10-17, from the screenshots: square cells so every skill fits even with the hero panel open; replaces the spread-evenly columns and settles the overlap) | builder-lite | `crunch/hero-bar` | ready (2053ca25; 32 px squares, drawer 856 px wide at 1600×900, Combat ends ~270 px clear of the open hero panel; director's gate: 5160 tests, cycles, build) | Sat | Sat |
| Brief 140 H3: the shine on main-action buttons (T-178) | builder-lite | `crunch/hero-bar` (`hb`) | ready (8251a1a7; Upgrade and Settle; no Craft button exists yet; director's gate: 5163 tests, cycles, build) | Sat | Sat |
| Work Permissions drawer centred (owner 2026-10-17: square cells look good; the drawer stays centred horizontally). Director's reading: centred on the visible mat, so with the hero panel open it centres in the space left of the panel and never sits under it | builder-lite | `crunch/hero-bar` | ready (04dba554; measured centred within 1 px at 1600×900 and 1280×800, panel open and closed; director's gate: 5165 tests, cycles, build) | Sat | Sat |

## Art pass, batch 1 (proposed and ruled 2026-10-15 evening)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Bench baselines retaken on a quiet machine (T-181), engine and draw | director | `main` | engine: done Thu 22:11 (owner asleep, PC quiet), committed. Draw: refused twice (Chrome ran one 4× scene at ~5×, the bench's own guard), saved on the third run Fri 01:00–01:41 and committed | Thu night | Fri |
| The owed 4× drag pair for the placing grid: before (`1f8239b3`) and after (`main`), cap128 | director | `p23b` then `main` | done: Token drags level (median pickup 67/67 ms, carry 36/36, drop 73/73 plain); the grid costs nothing measurable. Both runs had 1–2 flag drags grab a neighbour's flag on the full board, before and after alike (T-187) | Thu night | Thu |
| The owner's art sessions on the bench and the brightness script, here with the director at the owner's pace (owner 2026-10-15); the bake when a preset wins (tag `art-before-vibrancy`, dated zip, art-only commit on `main`) | owner + director | `main` | first pass done 2026-10-16: **Drag 1.15 / 1.25 wins**; the bake waits for the asset reorganisation (owner) | owner's pace | |
| Dev panel's Scatter Loot button names real items (T-184) | builder-lite | `fix/t184-dev-items` → `main` | merged Thu night (gate on the merged result: 4964 tests, cycles, build, work check same) | Thu | Thu |
| Floor loot lands on its spot and draws crisp (T-183) | builder | `fix/t183-loot-offset` → `main` | merged Thu night (same gate; in the game the landed loot measured 40 mat units up-left before, 0 after; the stack slide fixed alongside so piles don't jump; a small look fix, no eye-check) | Thu | Thu |
| Asset names and folders: the ruleset ([ASSET_NAMING.md](../reference/ASSET_NAMING.md), approved 2026-10-16), the rename list (builder, done), then the apply (engineer), then the bake | builder → engineer | `art/asset-rename` (`rn`) | list approved by the owner 2026-10-16 (three rounds of answers on the review page); step 2 built and verified by the director (4995 tests, cycles, build, list and legacy-name checks; the branch build in the game: slot screen, Starter Camp, Bank, Guild Hall with 0 failed pictures; CMS button changes sprite fields only). merged Fri 11:40 (work check same; timing 1.2–1.28× under daytime load, `main`'s control run read the same). done: the owner's first Sync came from a stale CMS workspace (it dropped 16 Tokens, 14 items, 9 recipes; reverted unpushed-then-pushed as a revert); after Restore from Game the second Sync changed sprite names only (86 Tokens, 71 items, 25 recipes). 162 local git-ignored leftovers (archive, maybe, waste) moved to `_art_leftovers/` for the owner to drag out | Fri | Fri |
| The bake: Drag 1.15 / 1.25 into 623 sprites | director + owner | `main` | merged Fri: tag `art-before-vibrancy` (pushed), owner's zip on the Desktop, owner approved in the game ([archived eye-check](../archive/eyecheck/2026-10-16_art-bake.md)) | Fri | Fri |
| A4: dragged Tokens lose the old drag brightening (the art carries it now) | builder-lite | `fix/a4-drag-filter` → `main` | merged Fri 13:10 (gate on the merged three: 5009 tests, cycles, build; work check same; timing noisy under daytime load, no engine code changed) | Fri | Fri |
| T-180: a Studio button brightens the material palettes the same way, pressed by the owner | builder | `art/palette-brighten` → `main` | merged Fri 13:10 (same gate). Owner pressed it and Synced: 1868 of 1961 colours in 100 of 101 palettes, marker written, content counts unchanged | Fri | Fri |
| Hover brightening gentler, 1.06 / 1.08 (owner ruling) | builder-lite | `fix/hover-gentler` → `main` | merged Fri 13:10 (same gate) | Fri | Fri |
| ART_STYLE.md: a short record of what is settled (owner 2026-10-16: the owner directs the art; no style interview) | director | `main` | draft, for the owner's approval | Fri | |
| The CMS warns before a Sync removes content (T-188) | builder | `fix/t188-sync-guard` → `main` | merged Sat 01:03 (work check same; timing noisy, no engine code changed) | Fri | |
| The white hover outline on Tokens is gone (owner report; reproduced: no outline picture is requested) | engineer | `fix/hover-outline` → `main` | merged Sat 01:03. Cause: the dev server answered freshly redrawn outline pictures with the game page (Vite serves `public/` files only after its watcher reports them; the rename made it redraw nearly all at start). Fix: the dev server reads the generated folder from disk. Game code was fine; production builds were never affected | Fri | |
| Re-bake at Gentle 1.08 / 1.12 (owner found Drag too bright in play) | director | `main` | merged Fri 22:45: back to the original from the tag, then baked at Gentle; all 623 match the bench column the owner picked | Fri | Fri |
| Palettes back to original, button at Gentle | builder-lite | `fix/palette-gentle` → `main` | merged Sat 01:03; owner: press the Studio button on `main`, then Sync | Fri | Sat |
| Terrain design advice (owner's goal for the terrain pass) | director | [notes page](https://claude.ai/artifact/PLTLkP5bqjLqtTc8YYJSpg) | sections 1–9; owner ruled the path 2026-10-16: computed edges plus the owner's hand-drawn edge pieces, Sea of Stars as the target (brief 180) | Fri | |
| Brief 180 G1: ground structure in code (tint pattern, organic earth with rim and fringe, grouped props) | engineer | `crunch/ground-g1` → `main` | merged Sat (owner: a clear improvement, more to do; gate on the merged result 5053 tests, build) | Fri | Sat |
| Ground design rounds 1–9 with the owner (generated ground; [rounds page](https://claude.ai/artifact/LefBh8qULf3JCdqUBb9jFY)) | director | `docs/active/research/ground_gen/` | done: final prototype approved with softer camouflage; spec `final_spec.json` | Sat | Sat |
| Brief 180 G3: generated ground in the game (meadow and forest) | engineer | `crunch/ground-g3` → `main` | merged Sat 13:40 (owner: looks good; work check same; draw +0.05–0.1 ms at 1×, within noise) | Sat | Sat |
| Brief 180 G4: Mountain, Coast, per-look dapple, ground strength slider, and four new biomes (flower meadow, cherry grove, Yellowstone, volcano) | engineer | `crunch/ground-g4` → `main` | merged Sat 13:50 (owner asked to merge; gate green but T-190's flaky timeout; work check same; draw level with main) | Sat | |
| World generation design rounds W1–W7 with the owner ([world page](https://claude.ai/artifact/XFe5Kj6P1RC9KiMREUTTmc)) | director + owner | `docs/active/research/ground_gen/` | done Sat: water by biome, lakes up to a fifth, rivers (uneven split, braided), blend variety, beaches at the sea, layouts core-and-rim and patchwork; brief 180 G5–G7 | Sat | Sat |
| Brief 180 G5: water in every Region (lakes, ponds, tarns, rivers, smooth shores, sulphur lakes as water) | engineer | `crunch/ground-g5` (`wg`) | fixes built and verified (5132 tests, cycles, build); re-check waiting (file items 10-12, port 5195). Was eye-check ([file](eyecheck/2026-10-17_g5-water.md); served from `wg` on port 5195, the owner folder stays on `main`). Director gate: 5122 tests, cycles, build. Bench queued: work check and one `bench:draw --compare` in the next window. Minor biomes water not built (question A in the file) | Sat | |
| Brief 180 G6 blends and beaches, then G7 layouts | engineer | — | after G5 | | |
| **Two directors (owner, 2026-10-17):** this session keeps the terrain and world generation; a second director takes other features. Terrain owns `src/systems/atlas/`, `src/systems/board/Terrain*.js`, `groundScreen.js`, `terrainRegistry.js`, `playmatTuning.js`, `src/ui/dev/terrainDev.js` and `docs/active/research/ground_gen/`. Shared on this PC: two code subagents at once in total, one heavy run (suite, build, bench) at a time, the owner's folder stays on `main` | — | — | standing | | |
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

- **Alert outline colour** (found by K1): UI_STYLE says alerts are a gold outline; the game draws Token alerts red (`outline="alert"`) and has for a while. Keep red for Tokens, switch to gold, or red for problems and gold for attention? Asked in the style kit's eye-check.

- **Recruits and Fight by default** (found by T-167): Fight is on by default for everyone, so a Recruit's flag now goes after peaceful enemies in its reach (a Cow, which a level 1 fighter loses to) and hostiles attack Recruits. Keep Fight on for Recruits (everyone fights, the player turns it off), or default it off for Recruits until promotion (the player turns it on for the tutorial fight)? Asked with T-167's eye-check.

Earlier: none open. (Ruled 2026-10-15: equip-by-drop opens the sheet a frame later,
T-186; the badges' soft shadows are settled inside T-013.)

## Bench queue (one at a time, weekdays 13:00–17:00 and 01:00–07:00, or when the owner says the PC is quiet)

1. `fix/t167-recruit-attack` (6790962d): engine work check (`npm run bench -- --compare`), features director.
2. `crunch/style-kit` (7060a37f): engine work check and one `bench:draw --compare` for the cost log, features director.
3. `crunch/hero-bar` (after H3): engine work check and `bench:draw --compare` (the level-up floats), features director.

## Summaries

**Sat 2026-10-17, evening: batches 1 and 2 at one eye-check.** Where we
are: the style kit, Recruits who fight and the hero bar (Work Permissions with
square centred cells, the level-up moment, the shine) are built and gated;
the hero bar branch holds all three, served on http://localhost:5198/ from
`hb` ([eye-check file](eyecheck/2026-10-17_style-kit.md), 17 checks, 8
questions). Next: the owner's look, fixes on the branches, the bench queue in
a quiet window, then merge kit → Recruits → hero bar. Owner: the eye-check
when free. Blockers: none.

**Sat 2026-10-17, 19:20: features batch 1 at the eye-check.** Where we are:
the style kit (page, shared arrow lists, text sizes, shared tooltip) and the
Recruits' attack are built and gated; [eye-check file](eyecheck/2026-10-17_style-kit.md),
served from the worktrees on 5196 and 5197 so the owner's folder stays on
`main`. Next: the owner's verdicts and seven questions; then the work check
(T-167) and a draw compare (kit) in a quiet window, merge. Owner: the
eye-check. Blockers: none.

**Sat 2026-10-17, evening: features batch 1 proposed and ruled.** Where we
are: `main` clean; five finished tickets closed in the archive. The batch: the
style kit (brief 100: page, shared list, text sizes and tooltip; one eye-check
at the end) and the Recruits' weak attack (T-167). Next: brief 140 (hero bar)
or 110 (map tools) on the kit. Owner: after T-167 lands, author a weak, safe
enemy in the Starter Camp. Blockers: none.

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

**Sat 2026-10-17, 01:45: director's closing summary.** Where we are: the art pass's first half is on `main`: assets renamed and filed, the Gentle bake (after Drag proved too bright), drag and hover adjusted, the Sync guard, the outline fix; brief 180 G1 (ground structure) passed its gate, work check and draw compare and waits for the owner's look on `crunch/ground-g1`. Next: the owner's verdicts, then the palette button and a Sync on `main`, then G2. Owner: see HANDOFF's to-dos. Blockers: none. Cost log: G1 S2 4× 107 → 100 fps, work p50 10.7 → 11.8 ms (within tolerance).
