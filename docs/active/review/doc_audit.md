# Doc audit, 2026-11-06

*Written for the code review and optimisation pass, on branch `prep/au` from `main` 93338609.
Every row checks at least one concrete claim against the code or git (`git log -1 --format=%cs`
gives the last edit; `git log --diff-filter=D` dates a deleted file). "Status line" means the
`Status:` first line concept docs must carry; living lists, handoffs and references don't need
one (n/a). Verdicts: **current** (trust it), **partly stale** (trust it except the lines named),
**stale** (don't trust it without checking), **archive** (finished history; move when the
director agrees).*

## Counts

| Verdict | Docs |
|---|---|
| current | 47 (the eleven `content_*.md` pages count one each) |
| partly stale | 18 |
| stale | 2 |
| archive | 8 |

(75 docs: 59 files in `docs/active/`, the `briefs/`, `research/` and `eyecheck/` folders as one
each, 11 files in `docs/reference/`, `cms/README.md`, `bench/README.md`. There is no root `README.md`.)

## Moves made: none, and why

- **Concept docs with `Status: built`**: `concept_cms_agent_authoring.md` (brief 200),
  `concept_notifications.md` (150), `concept_offline_progress.md` (40), `concept_recipe_list.md`
  (130), `concept_combat.md` (220), `concept_skill_and_class_rework_v2.md` (20). The brief's rule
  also needs the brief's row in `briefs/README.md` marked done or merged. **None is**: the order
  table marks only brief 90 and brief 210 done, and neither has a built concept doc. So nothing
  moved. Recommended once the director marks the rows: archive `concept_cms_agent_authoring`,
  `concept_offline_progress`, `concept_recipe_list`, `concept_skill_and_class_rework_v2` (superseded
  by classless heroes). Keep `concept_combat` (amended by the live `concept_combat_v2`) and
  `concept_notifications` (brief 430 built on it 6 Nov).
- **`HANDOFF_backlog.md`, `HANDOFF_features.md`, `HANDOFF_systems.md`**: neither `HANDOFF.md` nor
  `STATUS.md` names them or calls those directors closed, so they stayed. Evidence they are
  finished: `HANDOFF.md` (6 Nov) describes one director and "feature branches all merged and
  deleted"; brief 210's row is marked done; `HANDOFF_systems.md` links eye-check files that no
  longer exist in `docs/active/eyecheck/`. Recommended: archive all three.
- **Status lines added: none needed.** Every `concept_*.md` already has one.

## Fixes made

| Commit | File | Fix | Proof |
|---|---|---|---|
| 1e68d5f3 | `cms/README.md` line 18 | simulator path `src/engine/sim/` to `cms/src/engine/sim/` | `git ls-files` lists `cms/src/engine/sim/simRunner.js`; no `src/engine/` exists |
| d4c12bd9 | `docs/reference/TESTING.md` lines 100, 134-135 | dropped "the barrel `registries/index.js` hides orphans" and "the CMS imports seven game modules" (now "about 60"); dropped "(the bin sidebar)" | `registries/index.js` deleted in f95b555c (2026-08-24); `grep` of `cms/src` finds 62 distinct `src/` modules imported; the bin went in Atlas A3b (`DiscardBin.js` deleted 61dcfe64) |
| see report | `docs/reference/GDD.md` | four `⚠️ Stale since` notes, at §3 "What a Token is", §11, §12, §13 | rows below |

## docs/active

| Doc | Status line? | Verdict | Evidence | Action |
|---|---|---|---|---|
| HANDOFF.md | n/a | current | spot-checked ok: "feature branches all merged and deleted", `git branch --no-merged main` lists only `eyecheck/fights-rivers`, as it says; the Swift Laps pack exists in the main folder's `cms/incoming/` | keep |
| HANDOFF_backlog.md | n/a | archive | last edit 2026-11-03, written 2026-10-24; says "Brief 210 is complete", and the briefs table marks 210 done | archive (director's call: not named closed in HANDOFF/STATUS) |
| HANDOFF_features.md | n/a | archive | written 2026-10-21; its queue (briefs 130, 150) is merged; names `scratchpad/vite.ec.mjs`, not in the repo | archive (director's call) |
| HANDOFF_systems.md | n/a | archive | written 2026-10-27 for brief 240 K4; links `docs/active/eyecheck/2026-10-26_skill-loops-s9.md`, which does not exist | archive (director's call) |
| NOW.md | n/a | stale | "Updated 2026-11-05"; line 23 "Building next: 360 C2 and C3" and line 24 "Next: 360 C4, then 370": all merged 5–6 Nov (HANDOFF.md); line 11 "~7,350 tests" vs 7,794; line 15 "wandering enemies" vs brief 500 (enemies stand still) | fix lines 3–25 from HANDOFF.md (director) |
| STATUS.md | n/a | partly stale | link `eyecheck/2026-11-02_world-pack.md` (line 120) is broken: the file is in `docs/archive/eyecheck/`; rows say "waits for the owner's pick" (M1, G1, E1, P1) though the picks were built and merged | director trims (nobody else edits STATUS) |
| atlas_roadmap.md | n/a | archive | Atlas A1–A12 built (`concept_atlas.md` status); names 14 files that no longer exist, e.g. `DiscardBin.js` (deleted 61dcfe64, 2026-10-10), `ShopDrawer.jsx` (deleted 2dcd5804, 2026-11-06) | archive |
| class_rework_v2_roadmap.md | n/a | archive | describes jobs and promotion, retired by brief 270; `PromotionSystem.js` deleted eb180db9 (2026-10-29); 17 named identifiers (`getJob`, `JOB_TIERS`, …) are gone from the code | archive |
| concept_art_direction.md | yes | current | spot-checked ok: the brightness script it plans exists (`npm run art:brighten`) | keep |
| concept_atlas.md | yes | partly stale | the "Settling" bullet (line 76) settles a map item by consuming its recipe; maps retired with brief 330 (GDD §3 "Maps — Retired"); settling is now on the world map | keep; note the map lines as superseded by `concept_world_map.md` |
| concept_atlas_tome.md | yes | partly stale | the tome's pages were replaced by the world map (STATUS 380 M2: "the old book pages stay deleted"); `AtlasTome.jsx` survives only as the encyclopedia's frame | keep; mark the tome pages superseded |
| concept_basic_content.md | yes | current | spot-checked ok: the Bog biome it asks for is in `terrainRegistry.js` and `areaBanners.js` | keep |
| concept_classless_heroes.md | yes | current | spot-checked ok: promotion code gone (`PromotionSystem.js` deleted eb180db9) as it rules | keep |
| concept_cms_agent_authoring.md | yes (built) | current | spot-checked ok: `cms/incoming/` with its README exists; merged 1b6c55af | archive once brief 200's row is marked done |
| concept_collectors.md | yes (draft) | current | spot-checked ok: still a draft; no brief row (briefs README: "Collectors stays a draft") | keep |
| concept_combat.md | yes (built) | partly stale | lines 39 and 253 call `StatusEffectSystem.js`/`statusRegistry.js` a "clean-out candidate": deleted in 5a006a2e (2026-10-24); line 132 says `consumeLoopConsumables` has no caller: the function is gone from `src/` | fix lines 39, 132, 253 |
| concept_combat_v2.md | yes | current | spot-checked ok: all 6 named identifiers found in the code | keep |
| concept_content_roadmap.md | yes (draft) | current | spot-checked ok: the eleven `content_*.md` pages it lists all exist | keep |
| concept_detail_pass.md | yes | partly stale | line 1 says `draft` while every section is briefed and briefs 340–470 are merged (HANDOFF.md) | status line for the planning agent |
| concept_drag_hints.md | yes | partly stale | line 1 says `briefed`; brief 490 merged 411a6825 (STATUS) | status to `built` (planning agent) |
| concept_guild_hall.md | yes | current | spot-checked ok: the drop lap and its pack are as the status says (`cms/incoming/2026-11-06-drop-lap.json` in the main folder) | keep |
| concept_hero_orders.md | yes | current | spot-checked ok: `Orders.orderAt` exists (`src/systems/board/Orders.js`) | keep |
| concept_info_layers.md | yes | current | spot-checked ok: the problem lines retired as it rules (`blockedText` kept unspoken in `heroBubbles.js`, per speech_bubble_lines.md) | keep |
| concept_knowledge.md | yes | current | spot-checked ok: the encyclopedia exists (`src/ui/components/encyclopedia/EncyclopediaScreen.jsx`) | keep |
| concept_level_up.md | yes | current | spot-checked ok: `LevelUpFloat.jsx` exists | keep (status `briefed`; brief 140 built, planning agent may mark built) |
| concept_living_game.md | yes | current | spot-checked ok: "brief after the crunch": no brief row exists | keep |
| concept_map_tools.md | yes | partly stale | built on "the top bar's Disallow mode (`MatDisallowControls.jsx`)": that file was deleted 109f1709 (2026-10-18) and Disallow retired whole (brief 420 T2, HANDOFF.md) | mark the Disallow half retired |
| concept_notifications.md | yes (built) | current | spot-checked ok: line 9 says it replaces `PopOutSidebars.jsx`; deleted 2f98f7f8 (2026-10-19) | keep (brief 430 builds on it) |
| concept_offline_progress.md | yes (built) | partly stale | line 307 plans a `subscribeUi` helper that never existed (`git grep` finds none); the other 43 named identifiers exist | archive once brief 40's row is marked done |
| concept_progression.md | yes | current | spot-checked ok: no named code; status `briefed (brief 70)` and Atlas A1–A12 built | keep |
| concept_progression_ledger.md | yes | current | spot-checked ok: all 15 named identifiers found in `cms/src` | keep |
| concept_quests_tutorial.md | yes | current | spot-checked ok: quest board postponed, matching briefs row 18 | keep |
| concept_recipe_list.md | yes (built) | current | spot-checked ok: line 8 names the window it replaced; `StationRecipeModal.jsx` deleted 00103006 (2026-10-19) | archive once brief 130's row is marked done |
| concept_release.md | yes | current | spot-checked ok: "brief after the crunch": no brief row | keep |
| concept_skill_and_class_rework_v2.md | yes (built) | archive | its own line 1 says superseded by classless heroes; jobs and promotion retired | archive once brief 20's row is marked done |
| concept_skill_loops.md | yes | partly stale | line 449 names `consumeLoopConsumables`, gone from `src/` since 2026-10-24 | fix line 449 |
| concept_token_bars.md | yes | partly stale | line 71 "the fight's plate (`fightPlate.js`) are unchanged": the plate went in 779d8c30 (2026-11-05, brief 360 C3) | fix line 71 |
| concept_tone_and_world.md | yes | current | spot-checked ok: a writing guide; no code claims | keep |
| concept_tutorial_npc.md | yes | current | spot-checked ok: brief 480 L2–L4 not built (no `Limes` in `src/`), as the briefs row says | keep |
| concept_work_permissions.md | yes | stale | Work Permissions retired by brief 260 (`WorkRulesDrawer.jsx` deleted 4c01196c, 2026-10-28); status still `briefed` | archive (planning agent's call) |
| concept_world_map.md | yes | current | spot-checked ok: both named files exist | keep |
| content_alchemy.md … content_tailor.md (11 files) | yes | current | spot-checked ok: all `approved 2026-11-04, a CMS pack still to come`; no such pack in `cms/incoming/`; names not in the code are planned sprites | keep |
| design_pass_notes.md | n/a | current | edited 2026-11-05; owner taste notes, no code claims | keep |
| ideas.md | n/a | current | spot-checked ok: says nothing in it is decided; the one file it names, `stations.json`, is mentioned as gone | keep |
| owner_art_list.md | n/a | current | spot-checked ok: all 5 named files exist; edited 2026-11-06 | keep |
| owner_feedback.md | n/a | current | intake list, emptied by triage | keep |
| refinement_pass_todo.md | n/a | archive | its own status: "Fully triaged ... 2026-10-13: every item has moved on"; two links are `file:///c:/...` absolute paths | archive |
| terrain_roadmap.md | n/a | archive | brief 80 built (GDD §13); `TerrainDevSection.jsx` deleted 23ce56e5 (2026-10-24), `TerrainOff.test.js` gone | archive |
| ui_rework_list.md | n/a | partly stale | lines 121–128 "Hero work rules and the flag — locked" (`FlagRulesPanel.jsx`, deleted f3cb27f2): work rules and flags retired by brief 260 | mark that section retired |
| briefs/ (52 files) | n/a | partly stale | the order table marks only briefs 90 and 210 done, yet HANDOFF.md says 340–500 are merged; brief content not audited (out of scope) | the director marks finished rows |
| research/ (79 entries) | n/a | current | spot-checked ok: `research/world_hexes/contact_hexes.png` named in STATUS exists; dated research notes | keep |
| eyecheck/ | n/a | current | folder absent: the last file moved to `docs/archive/eyecheck/` on 6 Nov, as TESTING describes | none |

## docs/reference, cms, bench

| Doc | Status line? | Verdict | Evidence | Action |
|---|---|---|---|---|
| ART_STYLE.md | yes | current | spot-checked ok: links `research/terrain_art_list.md`, which exists | keep |
| ASSET_NAMING.md | yes | current | spot-checked ok: examples `items/tool/i_pick_copper.png` and `tokens/smith/t_anvil.png` exist under `public/assets/` | keep |
| CONTENT_PHILOSOPHY.md | n/a | current | written 2026-11-04/05 from the owner's rulings; no code claims | keep |
| GDD.md | n/a | partly stale | see "GDD stale sections" | notes added |
| PERFORMANCE.md | n/a | partly stale | see "PERFORMANCE stale sections" | fix two tables |
| TESTING.md | n/a | partly stale (fixed) | see "TESTING" | fixed in d4c12bd9 |
| TEXT.md | n/a | current | spot-checked ok: `src/i18n/index.js` and `src/tests/I18n.test.js` exist (`fr.json`, `de.json` are examples of files to add) | keep |
| TICKETS.md | n/a | partly stale | its rule says "Close: delete the row here" and move it to `tickets_done.md`; 51 of 150 rows are marked `done` and still listed (e.g. T-267, T-275 naming deleted `TokenInspection.jsx`) | the director sweeps done rows (ticket text untouched here) |
| UI_STYLE.md | n/a | current | spot-checked ok: `HardPixelShadows.test.js` and `panelBackdrop.js` exist | keep |
| WINDOW_GAME.md | n/a | current | spot-checked ok: `src/main.jsx:69` sets `window.Game = engine` | keep |
| speech_bubble_lines.md | n/a | current | spot-checked ok: `MOMENT_SPOKEN` is in `src/ui/components/board/heroSpeech.js` | keep |
| cms/README.md | n/a | partly stale | see "cms/README.md" | line 18 fixed |
| bench/README.md | n/a | partly stale | line 169 (S2): "the board is over the game cap of 80": the game cap is 128 (`BASE_TOKEN_CAP` in `src/systems/board/MatCap.js:20`) and S2 holds about 103–109 Tokens | fix line 169 (not done: correcting the number makes "over the cap" false, so the sentence needs the bench author) |

### GDD stale sections (line numbers after this branch's notes)

| Lines | Section | What is wrong | Proof |
|---|---|---|---|
| 164–170 | §3 What a Token is | "86 Token types ship: resource 48, … promotion 2, map 1, manager 1" | `data/tokens.json` holds 146: resource 65, spawner 22, station 22, enemy 18, buff 11, camp 4, promotion 2, market 1, context 1; no map or manager type |
| 1406 | §9 Screens and UI | "bubble menu → notification column → playmat": the column retired | `PopOutSidebars.jsx` deleted 2f98f7f8 (2026-10-19); the same section's line 1434 already describes stubs and banners |
| 1669 | §11 Tools | "Bench: 7 headless scenarios" | `bench/README.md` lists 12 (S1–S8, S8L, S8F, C240, C256); S8 added f44e78a4 (2026-10-08) |
| 1652–1660 | §11 Tools | Sync "overwrites items.json (maps included), tokens.json, tokenRecipes.json and effects.json" | `cms/vite-plugin-cms-api.js:835–856, 972–978` also reads and reports `starterCamp.json`, `skillPerks.json`, `hallStars.json`, `world.json`; maps retired (brief 330) |
| 1675–1689 | §12 Content snapshot (2026-10-08) | Tokens 86, items 64, recipes 25, effects 22, jobs reachable | `data/`: 146 Tokens, 151 items, 117 token recipes, 92 effects; jobs retired (brief 270) |
| 1695–1706 | §13 Planned and dormant | "Atlas — Planned for the crunch" | Atlas A1–A12 built (`concept_atlas.md` line 1) |
| 1714 | §13 | "`data/stations.json` (nothing loads it)" | deleted 26a434c9 (2026-10-07) |

Spot-checked ok elsewhere: §3 Shop sells only Foundations (line 337, brief 410); §4 classes
retired (542); §5 Bank Slots retired (780); §6 no ambushes (940, 976); §8 Scouting Flags retired
(1329); §16 Token cap 128 (matches `MatCap.js:20`).

### PERFORMANCE stale sections

| Lines | Section | What is wrong | Proof |
|---|---|---|---|
| 3–5, 21 | header, conditions | "Baseline recorded 2026-10-07 … at `main` `9a07e320`" | `bench/baseline.json` and `draw-baseline.json` meta: commit c46d6775, 2026-11-04 (retaken eceaa85c; also d0caf863 29 Oct, b4aa17f2 3 Nov) |
| 190–201 | Engine baseline table | S2 p50/p99 0.297/0.593 ms, S7 1.909/2.495 ms; no S4, S8, C240, C256 | `bench/baseline.json`: S2 0.342/0.825, S7 1.387/2.336, S3 0.803/1.840; C240 p99 4.79, C256 p99 20.9 ms |
| 203–221 | Drawing baseline table | dated 2026-10-07 | `draw-baseline.json` retaken 2026-11-04 |
| 437–1250 | certification run, brief 60 results | a historical record; names deleted files (`PopOutSidebars.jsx`, `Toast.jsx`, `ToastContainer.jsx`, `TutorialAideOverlay.jsx`) and guard tests that no longer exist (`CycleRingSteps.test.js`, `ShutNotificationColumn.test.js`, `TutorialBeaconRect.test.js`) | `git ls-files` finds none of them |
| 1251–1563 | Performance Envelope (2026-10-21) | measured before the 30 % spacing and briefs 340–500; still the GDD §14 reference | dated; keep, re-measure in the optimisation pass |

Spot-checked ok: the "Keeping it fast" rules (45–189): every named helper (`createMatStack`,
`setDrawingPaused`, `snapshotDndRegions`, `useEntityDrag`, `BOB_PHASE_GRID_MS`, …) exists.

### TESTING

| Lines | What was wrong | State |
|---|---|---|
| 134–135 | the `registries/index.js` barrel (deleted f95b555c) and "the CMS imports seven game modules" (62) | fixed d4c12bd9 |
| 100 | "a pop-out (the bin sidebar)": the bin is gone | fixed d4c12bd9 |
| 132 | the tool list lacks the review tooling added in 93338609 (`npm run dead-code`, `npm run depcruise`) | not fixed (an addition, not a correction) |

Spot-checked ok: `src/tests/setup/seededRandom.js` and `FG_TEST_SEED`; `SaveFiles.js`;
`tools/reachability.mjs` walks from `main.jsx` only; `npm run cycles` exists.

### cms/README.md

| Lines | What is wrong | Proof | State |
|---|---|---|---|
| 18 | simulator in `src/engine/sim/` | it is `cms/src/engine/sim/` | fixed 1e68d5f3 |
| 3–4, 14–16 | authors and syncs "Maps"; Sync overwrites five named files | maps retired (brief 330); the Sync route also handles `starterCamp.json`, `skillPerks.json`, `hallStars.json`, `world.json` (`vite-plugin-cms-api.js:835–856`) | not fixed (the full file list needs the Sync code read end to end) |
