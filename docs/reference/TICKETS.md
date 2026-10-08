# Tickets — the one backlog

**This is the only place open work is tracked.** Bugs, performance, cleanup,
tests, owner to-dos and pending design questions all live here. Feature plans
live in their roadmap docs; when a plan leaves loose ends, they become tickets
here.

## Rules

- **Add**: next free `T-` number (see the counter), one row, one line. Put
  detail in the row or link a section of a live doc; never start a new list
  somewhere else.
- **Close**: delete the row here and append one line to
  [`docs/archive/tickets_done.md`](../archive/tickets_done.md):
  `T-NNN — summary — commit hash — date`.
- **Status**: `open` (anyone may take it) · `owner` (blocked on the owner —
  say on what) · `blocked` (say on what) · `ride-along` (do only while already
  editing that code).
- **Priority**: **P1** a player can hit it, or a measured miss of a target ·
  **P2** real cost or risk · **P3** tidy-up.
- **Origin**: the old ID, so the full write-up can be found in
  `docs/archive/` (CR3 = code review round 3, `docs/archive/review_v3/`;
  FB = token lifecycle feedback; FMR = free playmat review, 2026-09-21).
- **Before closing a batch**: the merge gate in
  [`docs/reference/TESTING.md`](TESTING.md) (tests, bench, cycles).

**Next free number: T-110**

---

## 1. Waiting on the owner

| ID | What | Origin |
|---|---|---|
| T-001 | **CMS** (owner does it; checklist below): Wood Foundation sprite → `token_foundation_wood`, Stone Foundation → `token_foundation_stone`, Stone item → `item_stone`; **delete Copper Rubble** and set Copper Ore's value source to Copper Ore Vein. ⚠️ Foundations came into the game by a CMS sync (`ece14ea9`); if the CMS no longer shows them, restore the workspace from game files before syncing, or the sync deletes them from the game. Then Sync to Game; then T-109. | CR3 summary |
| T-002 | **CMS: delete all 8 Maps** in `data/maps.json` and all 7 Map Tokens, **including the Oak Forest Map** (owner 2026-10-07; the tutorial's Explore step is already gone). Also clears the missing `token_fallen_oak_tree`. The Atlas gets fresh Map content. Then T-109. | FB §5, GDD |
| T-007 | **Coal Vein at 4 s**: accept, re-tag its purpose from gold to items (~3 s), or leave for the simulator rework? | FB §5.1 |
| T-008 | **Flag Radius upgrade art**: keep borrowing the plain hero flag, or use the red banner art? | FB §5.2 |
| T-009 | **Shop price format**: full item row (icon, name, have/need) or the compact icon-and-number pills of the Hall's Upgrade button? | FB §5.3 |
| T-010 | **Speech bubble audit**: add/remove list for `docs/reference/speech_bubble_lines.md`. | FB §5.5 |
| T-011 | **Watch by eye** (no agent has seen these on screen): Token hit animations + transform glow, loot flight to the Hall, Shop drawer, countdown badge. | FB §5.6 |
| T-012 | **Transforms now push neighbouring Tokens** (the playmat plan said only bursts and spawns push). Keep or change? | FMR |
| T-013 | **The last ~65 alert-icon glows and ~105 label text-shadows**: switch them to the hard-pixel style too? | CR3 summary |
| T-014 | **Starting and quest content is written in engine code**, not the CMS. Move it to content? (Design call, never asked.) | CR3-515 |

## 2. Open work

### Engine

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-015 | P2 | open | Retire `state_changed`, stages 2–3 (stage 1 = `GAME_RESET`, merged). | CR3-305 |
| T-016 | P2 | open | A loot sweep publishes one event per sprite; batch it. | CR3-255 |
| T-017 | P2 | open | Kill loot ignores yield / double-loot / bonus-drop rules — reachable, `BONUS_DROP` and `LOOT_MULT` ship. **Owner 2026-10-06: yes, apply them exactly as for work.** | CR3-256 |
| T-018 | P2 | open | A crafted Token can arrive with unlimited charges — reachable (Copper Woodaxe). Ruling (A) per R3-Q1. | CR3-045 |
| T-019 | P2 | open | The engine starts a game only when React says so → add `Engine.startSlot`; reuse CR3-100's test as the headless boot test. | CR3-307 |
| T-020 | P3 | open | Three small rules copied into UI components; move them to the engine, show refusals on screen. | CR3-308 |
| T-021 | P3 | open | Two ways into the engine; settle on one (R5-Q2 ruling A). | CR3-512 |
| T-022 | P3 | open | Rate trackers never cleared on load (clear only; "count at drop time" is a separate design call). | CR3-263 |
| T-023 | P3 | open | `GLOBAL_COMBAT_XP_MULTIPLIER` wired to nothing (value is 1.0, so wiring it is invisible). | CR3-261 |
| T-024 | P3 | open | `map_burst` and `map_opened` both report `map_burst` (double count, hidden by the cap). *Unverified since 2026-09-21.* | FMR |
| T-025 | P3 | open | `buyMap` ignores the Shop's `sourceRect`. *Unverified since 2026-09-21.* | FMR |
| T-026 | P3 | ride-along | Small per-tick allocations in combat and statuses. | CR3-032 |
| T-027 | P3 | ride-along | Motion ticks allocate small objects per walker. | CR3-153 |
| T-097 | P2 | open | Move the Token cap, mat size and quest cap/interval out of the dev Mat Tuner into fixed game values (Hall upgrades may raise them later); hide Debug Mode and the QA tools in shipped builds. Owner 2026-10-06. | GDD §16.1 |
| T-098 | P2 | open | Remove hero energy (dormant). Drinks heal like food: keep the separate food and drink slots, both eaten below 25 % HP. Owner 2026-10-06. | GDD §16.7 |
| T-099 | P3 | open | **Passive Production** replaces "trickle": all Guild Hall passive income on one 5-minute timer, renamed everywhere; the Wishing Well joins it (about 10 Water per 5 min, scaling with rank), no hero needed. Owner 2026-10-06, `docs/active/ui_rework_list.md`. | owner |
| T-101 | P2 | open | **Bug**: binned Tokens don't count toward their spawner's family cap, so keeping spawned Tokens in the bin lets a spawner exceed its cap. Binned Tokens must count toward spawner caps and Token counts. | owner UI list |
| T-102 | P2 | open | **Token cap 80, and spawned Tokens count too** (today only placed Tokens count). Base 80 for testing; a Guild Hall upgrade raises it later. Decide with the owner how this interacts with spawner family caps. Owner 2026-10-06. | owner UI list |

### UI

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-028 | P2 | open | Toast types look alike and "×N" never shows. Ruling: a coloured edge per type, "×3" for merged repeats. | CR3-452 |
| T-029 | P2 | open | Every surface closes differently. Ruling: Escape closes the top layer only; click-outside closes light pop-ups only; drawers never close on a stray click. | CR3-454 |
| T-030 | P2 | open | Five tooltip implementations. Ruling: one shared gold-bordered tooltip; plain browser tips only on icon buttons. | CR3-455 |
| T-031 | P2 | open | z-index: one table for the mat, ~20 literal values elsewhere; unify. | CR3-456 |
| T-032 | P2 | open | Typography window is boxed inside Settings; Escape leaves its preview applied. *Suspected.* | CR3-453 |
| T-033 | P1 | open | **Picking up, dropping and carrying redraw every draggable.** Measured by the owner 2026-10-07 (dev build, S2): ~90 ms pause at every pickup (seen as a hitch), ~60 ms at every drop, the mat redraws ~115×/s while carrying (6 % of frames over 16.7 ms); S3: 226 ms pickup. Fix in the drag deep-dive (a memoised Token grab); see `docs/reference/PERFORMANCE.md`. | CR3-400 |
| T-035 | P2 | open | A push shoves overlapping Tokens anywhere on the mat. Ruling: move only what the newcomer crowds (and what that pushes into). ⚠ The bench will report WORK CHANGED for S4 — expected, accept it here. | CR3-151 |
| T-036 | P3 | open | One close-button look: the red pixel-art cancel icon everywhere. | R8-Q3 |
| T-037 | P3 | open | Two ways to hide notifications; keep only "Collapse". | R8-Q8 |
| T-038 | P3 | open | Text sizes / fonts written in code aren't what renders; rewrite them to match (no visible change). | CR3-460 |
| T-039 | P3 | open | Sci-fi words on screen ("Protocol Settings", "SYSTEM BOOT", "neural sync") and other retired vocabulary → plain words. | CR3-464 |
| T-040 | P3 | open | Rules text says "tile". Ruling: "where this one stands", "on the nearest / a random free spot"; Nearby hint = "Tokens within reach of this one". Regenerate RenderGolden and read its diff. | CR3-500 |
| T-041 | P3 | open | A newly recruited hero's class reads "Adventurer", not "Recruit" (`HeroRehydration.js:50`). | FB §5 |
| T-042 | P3 | open | Settings toggle "Item Fly Particles" still says "between cards and inventory". | FB §5 |
| T-043 | P3 | open | Empty-string duplicate React key logged on save load. *Unverified since 2026-09-21.* | FMR |

### Cleanup — dead code, vestiges, lint *(safe, invisible; delete tests only with the code they test)*

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-044 | P3 | open | Two dead dock components (+ `HeroDockTab`'s ignored props). Update `Promotion.test.js:351,387` comments. | CR3-024, 463 |
| T-045 | P3 | open | Dead combat, wound and loot code. | CR3-036 |
| T-046 | P3 | open | A second hero-creation route. | CR3-037 |
| T-047 | P3 | open | 8 retired `collection` fields in the save schema (keep `TOKEN_TYPES`). | CR3-038 |
| T-048 | P3 | open | Small UI leftovers incl. the `ui:open_drawer` chain; events subscribed with no publisher. | CR3-043, 461 |
| T-049 | P3 | open | Computed-and-never-read values; unused reset functions. | CR3-205 |
| T-050 | P3 | open | Stale comments in board-state files; `hitRadiusOf` doc claims whole-number centres. | CR3-154, FMR |
| T-051 | P3 | open | Four copies of "is this the Guild Hall?"; a second `clampToMat`. | CR3-155 |
| T-052 | P3 | open | Dead drag CSS; retired vocabulary in drag code. | CR3-406, 408 |
| T-053 | P3 | open | Nav "rise above my own modal" can't work; `useUIModals` controls nobody uses. | CR3-459, 462 |
| T-054 | P3 | open | Stylesheets loaded but unused / used but never loaded. Check `modals.css` for global selectors before deleting. | CR3-465 |
| T-055 | P3 | open | Equip-flash timer cleanup never runs. | CR3-466 |
| T-056 | P3 | open | Dead tile/Tray-era code (Tray-named constants renamed in hygiene W4); remaining: Tray-as-current comments; card/deck-era names; Tray dormant storage in `BoardState`/save. | CR3-502, 503, 504, FMR |
| T-057 | P3 | open | Rename tile-named engine vocabulary — code names and event strings together, one slice. | CR3-501 |
| T-058 | P3 | open | Lint residue (~74 old errors), per area: engine, combat (keep `MERGE_GRACE_MS` at 1100), UI↔engine (don't add hook deps blindly), renderer, UI. | CR3-110, 265, 312, 359, 467 |
| T-059 | P3 | open | The CMS imports `itemRegistry` for one constant. | CR3-511 |
| T-060 | P3 | blocked (soak) | Toasts may leave page elements behind. A 60-minute soak decides: certification Part G (`docs/archive/certification_checklist.md`), or automate it with the drawing bench's Chrome driver. | CR3-039 |
| T-061 | P3 | open | `cardSizeStore` is half dead (the drag ghost still reads it); unreachable Shop branches in `InspectionPanel.jsx`. | FB §5 |
| T-062 | P3 | open | `statementText.js` contains a literal NUL byte, so git treats it as binary (no diffs). | FMR (still true 2026-10-06) |
| T-063 | P3 | open | `resolveAnimationPath` hard-codes an id map and uses a relative `assets/` path. *Unverified since 2026-09-21.* | FMR |
| T-064 | P3 | open | Dead clock surfaces and write-only fields (R1-Q4 ruling A). | CR3-105 |
| T-093 | P3 | open | Stale comments found by the GDD survey (2026-10-06): skill/job headers say 27 skills and 6 held (29; 9/11/13 held); `RegenSystem` says only idle heroes regen (also working and fighting); `BoardCombat.tickToken` says enemies never aggro (hostiles do); `reachRegistry` says Near = 8 tiles on a 6×6 board (164 u, 4 sides); `MatCap.js` says nothing enforces the cap (Shop and recipes do); `Restrictions.js` mentions the Vault; `constants.js` says yield/work-time/input-cost axes are unread; `recipePoolRegistry` says 3 recipes; `tempoBands`/`dials` say nothing reads them; `BubbleMenu` says 5 bubbles; `TimeBankWidget` says it is mounted; `ConsumptionSystem` describes the deck loop; `loopConstants` mentions 100×. | GDD survey |
| T-094 | P3 | open | Dead-code leftovers after hygiene W3 (2026-10-07): functions now used only by tests (`resolveYield`, `getYieldMultiplier`, the other two `EffectAxes` helpers); Villager remnants (`isVillager` branches in `EquipmentValidator`, `HeroRehydration`, `PromotionSystem`, `SkillSystem`); `HeroDockTab`'s unused `onClick` prop; inert `effectFilesGlob`/`recipePoolFilesGlob` in `DatabaseManager.js`. `Placement.removePlacedToken` is kept (benches and tests use it). | GDD survey, W3 |
| T-108 | P3 | open | `cardUseCounts` (counts completed cycles per Token type; `GameState.js`, `BoardRunner.js`) is a deck-era name; rename it after the parked `atlas-wip` branch is merged or dropped (its `StateSchema.js` edit declares the field). | hygiene W4 |
| T-109 | P2 | open | **After the owner's T-001/T-002 CMS sync**: update tests and fixtures that use shipped Copper Rubble or Map content (`RenderGolden` fixture, `ExploreChain`, `MapBurstRetired`, `NewGameOpening`, `SaveSchemaDeclared`, `AssetManager`), delete tests of retired Maps together with dead Map code, and confirm the AssetManager failure is gone. | owner 2026-10-07 |
| T-095 | P3 | open | The tutorial beacon for "Plant a Flag" probably targets nothing: its selectors (`#rightmost-hero-dock`, `#hero-dock`) match no element in the bottom dock. *Unverified — check in the game.* | GDD survey |
| T-103 | P3 | open | Comment-slimming leftovers: `src/state/StateSchema.js` (held back, owner's Atlas edit uncommitted), 2 comments in `cms/src/components/editors/RulesLine.jsx`, `cms/src/engine/sim/dryRun.mjs` header, `filterTargetTiles` named in `reachRegistry.js:26,136` (now `filterTargets`), ~15 test comments clipped by the ID stripper (e.g. `AdjacencyEffects.test.js:82`), and trailing string text carrying IDs (`workSkillRule.js` WORK_SKILL_WHY, `lifecycleAudit.js`, `matTuning.js` hints). Also dead exports found: `PERSONALITY_TAGS`, the three tutorial selectors in T-095. | Slimming pass |

### Drag (found by `npm run bench:drag`, 2026-10-07; fix in the drag deep-dive, then re-run the bench to 100 %)

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-104 | P1 | open | **A closed hero sheet keeps catching drops in the middle of the mat.** The sheet in `BottomHeroDock` is hidden with opacity 0 but stays mounted while a hero is still selected, so its equipment-slot drop targets (`dock-slot-drop-…`, `DockEquipmentGrid`) stay registered; dnd-kit ignores `pointer-events`. Any mat drop inside its box (about the mat centre) is refused. Caused most failures of the bench's overlays pass. Confirmed in code by the director. | bench:drag |
| T-105 | P2 | open | A hero sprite's transparent pixels block grabbing the flag behind it (`MatHero` alpha test refuses the press; nothing starts). | bench:drag |
| T-106 | P2 | open | Some flags can't be grabbed or grab a nearby Token instead, even at a point clear of Token art: Token hit areas may be larger than their art circles. *Cause unverified.* | bench:drag |
| T-107 | P2 | open | Alert marks over a Token (`TokenCentreAlert`, `MatPointAlerts`) block presses on that Token. (The owner's UI list removes these alerts anyway.) | bench:drag |

### Build, tests, docs

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-065 | P2 | open | 3 of 7 test fixtures still borrow real `item_` ids — their rename changes the bench fingerprint, so land it as its own accepted commit. | CR3-551 |
| T-066 | P2 | open | 19 CMS-importing test files can't run in a worktree: link `cms/node_modules` too; remove both links before removing the copy. | CR3-552 |
| T-067 | P3 | open | Skipped tests: the Map-burst rule skips still need a ruling or deletion. | CR3-554 |
| T-068 | P3 | open | Build ships and preloads scrap art (`archive`/`maybe`/`waste`); keep it out of the build and the preload list. | CR3-508 |
| T-069 | P2 | open | Write the mat-era guide to keeping it fast in `docs/reference/PERFORMANCE.md` (the baseline and how-to-measure parts exist since 2026-10-07; draft in `docs/archive/review_v3/R6.md` §8 + `R7.md` §4). | CR3-021 |
| T-070 | P3 | open | Document `window.Game` — agents rely on ~30 entries the game never reads. | CR3-040 |

## 3. Parked — don't work on these without a reason

*Latent = the code is wrong but no shipped content triggers it. Fix it, test
first, when content that uses it is authored.*

| ID | Why parked | Summary | Origin |
|---|---|---|---|
| T-071 | Envelope | Canvas mat. Certification (2026-10-07): the realistic board passes, ~320 Tokens reaches 83 % of frames in budget. Unnecessary at realistic sizes; decide with the Performance Envelope whether boards that large must be smooth. | CR3-355 |
| T-072 | after the crunch | `@ts-check` trial on the contract layer. | CR3-560 |
| T-073 | latent | Input-cost discount applied when paying, not when checking. | CR3-028 |
| T-074 | latent | Item rules can be given moments that never fire. | CR3-202 |
| T-075 | latent | Rule upkeep pays from the Bank only (spawner upkeep is fixed by TL-20). | CR3-204, FB §5.4 |
| T-076 | latent | Each cure reaches only one of the two effect systems. | CR3-251 |
| T-077 | latent | Timed effects lose combat numbers on reload; use game time, not the wall clock. | CR3-252 |
| T-078 | latent | Loadout re-expanded on every axis read. | CR3-253 |
| T-079 | latent | Loading rewrites the Guild Hall's definition. | CR3-257 |
| T-080 | superseded | Time Bank fast-forward doubles tick cost. The Time Bank is being replaced by real offline progress (crunch track, owner 2026-10-06). | CR3-104 |
| T-081 | latent | Engine init isn't safe to run twice — only matters with a "back to title" feature. | CR3-108 |
| T-082 | latent | Shop's unreachable refund path skips mat events. | CR3-206 |
| T-083 | re-check | Synchronous subscribers; several whole-mat rebuilds per tick. Probably closed by Wave 3b — re-measure before working on it. | CR3-102 |
| T-084 | not needed | Push solver all-pairs (S4 worst push ~15 ms vs 8). Only matters past ~250 Tokens; T-035 may make it moot. | CR3-152 |
| T-085 | contract note | Loot timing uses the wall clock. | CR3-014 |
| T-086 | needs a Codex screen | Enemy kill counts never recorded. | CR3-035 |
| T-087 | owner-deferred | Desktop-shell group (save export, `src-tauri`). | CR3-046 |
| T-088 | Stage 2 | Randomness is unseeded and has no injectable source. | CR3-044 |
| T-089 | Stage 2 | Hero state lives in seven stores. | CR3-561 |
| T-090 | Stage 3 | Terrain can't be added through the CMS. | CR3-564 |
| T-091 | Stage 3 | Tokens teleport; mat size is dev tuning. | CR3-565 |
| T-092 | design | The free-playmat plan's "Map stays unopened" overflow rule (FP-46) is unbuilt; overflow drops as loot. | FMR |
| T-100 | before release | Master volume defaults to 0 so the owner can work in silence; set an audible default before shipping. | GDD §16.10 |
