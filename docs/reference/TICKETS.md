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

**Next free number: T-133**

---

## 1. Waiting on the owner

| ID | What | Origin |
|---|---|---|
| T-007 | **Coal Vein at 4 s**: accept, re-tag its purpose from gold to items (~3 s), or leave for the simulator rework? | FB §5.1 |
| T-008 | **Flag Radius upgrade art**: keep borrowing the plain hero flag, or use the red banner art? | FB §5.2 |
| T-009 | **Shop price format**: full item row (icon, name, have/need) or the compact icon-and-number pills of the Hall's Upgrade button? | FB §5.3 |
| T-010 | **Speech bubble audit**: add/remove list for `docs/reference/speech_bubble_lines.md`. | FB §5.5 |
| T-011 | **Watch by eye** (no agent has seen these on screen): Token hit animations + transform glow, loot flight to the Hall, Shop drawer, countdown badge. | FB §5.6 |
| T-012 | **Transforms now push neighbouring Tokens** (the playmat plan said only bursts and spawns push). Keep or change? | FMR |
| T-013 | **The last ~65 alert-icon glows and ~105 label text-shadows**: switch them to the hard-pixel style too? | CR3 summary |
| T-014 | **Starting and quest content is written in engine code**, not the CMS. Move it to content? (Design call, never asked.) | CR3-515 |
| T-127 | **Markets are cut for now** (owner 2026-10-09, D2): the Shrimp Market Token runs but pays nothing. Retire or repurpose it in the CMS (it turns up from Shrimp Coast content). The GDD §16 question is closed. | concept_progression.md |
| T-129 | **A Token in your hand can vanish**: a goblin your hero is fighting can die while you carry it, and a Token worked down to its last charge can be used up mid-drag; the drop then lands nothing (seen once in 100 bin drags by the drag bench, 2026-10-09). Pause work and fights on a carried Token, as growing already waits (recommended), or leave it? The bench now passes over enemies in a fight. | brief 50 D2 |
| T-130 | **A flag's cloth now beats a Token under it** (brief 50 D2, built, partly reverses ruling B5 that a Token's round body always wins): a flag standing wholly over Tokens could not be picked up on the mat at all. Now the coloured banner of a flag drawn in front of a Token takes the press; its pole, grass and empty corners still give way. Keep (recommended), go back to B5 (such a flag moves only by its hero or the hero bar), or let the whole drawn flag win (its grass tuft then covers the centre of a Token it is planted on)? Either way a flag wholly under things drawn in front of it (a worked Token is drawn above every resting flag) is pressed nowhere on the mat; the drag bench passes such a flag over. | brief 50 D2 |

## 2. Open work

### Engine

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-015 | P2 | open | Retire `state_changed`, stages 2–3 (stage 1 = `GAME_RESET`, merged). | CR3-305 |
| T-125 | P2 | open | **Remove the +0.5 % work speed per skill level** (owner 2026-10-09, D2: invisible, one more number to balance). `SKILL_SPEED_FACTOR` in `src/config/FormulaRegistry.js`; check the CMS simulator's tempo maths (GDD §11: slower by `1 + (level−1)/70`) and the GDD's Skills section. Changes play: eye-check; the bench will show WORK CHANGED, accept under this ticket. | concept_progression.md |
| T-126 | P2 | open | **Gathering tools become hero gear and last forever** (owner 2026-10-09, D2 + D4): pickaxes, woodaxes, fishing rods, sickles are carried in a hero's hands alongside weapons (hands: 2) and set what they can gather; tool Tokens on the mat go away; stations (anvils, furnaces) stay Tokens. Nothing wears out. Today tools are context Tokens and some recipes spend their charges (`Charges.js`, `requiresContext`); GDD says "Tools are not hero equipment". A design-to-code job for the post-crunch build, with the CMS content to match. Changes play: eye-check. | concept_skill_loops.md |
| T-016 | P2 | open | A loot sweep publishes one event per sprite; batch it. | CR3-255 |
| T-017 | P2 | open | Kill loot ignores yield / double-loot / bonus-drop rules — reachable, `BONUS_DROP` and `LOOT_MULT` ship. **Owner 2026-10-06: yes, apply them exactly as for work.** | CR3-256 |
| T-018 | P2 | open | A crafted Token can arrive with unlimited charges — reachable (Copper Woodaxe). Ruling (A) per R3-Q1. | CR3-045 |
| T-019 | P2 | open | The engine starts a game only when React says so → add `Engine.startSlot`; reuse CR3-100's test as the headless boot test. | CR3-307 |
| T-020 | P3 | open | Three small rules copied into UI components; move them to the engine, show refusals on screen. | CR3-308 |
| T-021 | P3 | open | Two ways into the engine; settle on one (R5-Q2 ruling A). | CR3-512 |
| T-022 | P3 | open | Rate trackers never cleared on load (clear only; "count at drop time" is a separate design call). | CR3-263 |
| T-023 | P3 | open | `GLOBAL_COMBAT_XP_MULTIPLIER` wired to nothing (value is 1.0, so wiring it is invisible). | CR3-261 |
| T-026 | P3 | ride-along | Small per-tick allocations in combat and statuses. | CR3-032 |
| T-027 | P3 | ride-along | Motion ticks allocate small objects per walker. | CR3-153 |
| T-097 | P2 | open | *(Token cap done in T-102: `MatCap.BASE_TOKEN_CAP`.)* Move the mat size and quest cap/interval out of the dev Mat Tuner into fixed game values (Hall upgrades may raise them later); hide Debug Mode and the QA tools in shipped builds. Owner 2026-10-06. | GDD §16.1 |
| T-098 | P2 | open | Remove hero energy (dormant). Drinks heal like food: keep the separate food and drink slots, both eaten below 25 % HP. Owner 2026-10-06. | GDD §16.7 |

### UI

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-028 | P2 | open | Toast types look alike and "×N" never shows. Ruling: a coloured edge per type, "×3" for merged repeats. | CR3-452 |
| T-029 | P2 | open | Every surface closes differently. Ruling: Escape closes the top layer only; click-outside closes light pop-ups only; drawers never close on a stray click. | CR3-454 |
| T-030 | P2 | open | Five tooltip implementations. Ruling: one shared gold-bordered tooltip; plain browser tips only on icon buttons. | CR3-455 |
| T-031 | P2 | open | z-index: one table for the mat, ~20 literal values elsewhere; unify. | CR3-456 |
| T-032 | P2 | open | Typography window is boxed inside Settings; Escape leaves its preview applied. *Suspected.* | CR3-453 |
| T-033 | P1 | open | **Picking up and dropping still hitch now and then; on a very full mat, at most drops.** Owner 2026-10-07 (dev build, S2): ~90 ms pause at every pickup, ~60 ms at every drop. The drag deep-dive's D3 (2026-10-09) stopped a drag redrawing every draggable: `bench:drag` (perf build, S2, plain pass) now finds a frame over 16.7 ms in 0–9 of 50 pickups (was 47–50) and 0–11 of 50 drops (was 44–50), the median drag's longest frame 6–12 ms (was 18–30); with bubbles showing, pickups 0–10, drops 5–13. Left: Bank pickups (9–10 of 50) and drops, Shop drops (11–13 of 50), and S3 (~320 Tokens), where 41–49 of 50 drops and 11–50 of 50 pickups still have one, typically 18–24 ms, and carrying 6–20 of 50 drags (0.3–0.8 % of frames; the board alone 0.29 %). Causes and numbers: `docs/reference/PERFORMANCE.md`, D3 findings. | CR3-400 |
| T-035 | P2 | open | A push shoves overlapping Tokens anywhere on the mat. Ruling: move only what the newcomer crowds (and what that pushes into). ⚠ The bench will report WORK CHANGED for S4 — expected, accept it here. | CR3-151 |
| T-036 | P3 | open | One close-button look: the red pixel-art cancel icon everywhere. | R8-Q3 |
| T-037 | P3 | open | Two ways to hide notifications; keep only "Collapse". | R8-Q8 |
| T-038 | P3 | open | Text sizes / fonts written in code aren't what renders; rewrite them to match (no visible change). | CR3-460 |
| T-039 | P3 | open | Sci-fi words on screen ("Protocol Settings", "SYSTEM BOOT", "neural sync") and other retired vocabulary → plain words. | CR3-464 |
| T-040 | P3 | open | Rules text says "tile". Ruling: "where this one stands", "on the nearest / a random free spot"; Nearby hint = "Tokens within reach of this one". Regenerate RenderGolden and read its diff. | CR3-500 |
| T-041 | P3 | open | A newly recruited hero's class reads "Adventurer", not "Recruit" (`HeroRehydration.js:50`). | FB §5 |
| T-042 | P3 | open | Settings toggle "Item Fly Particles" still says "between cards and inventory". | FB §5 |
| T-043 | P3 | open | Empty-string duplicate React key logged on save load. *Unverified since 2026-09-21.* | FMR |
| T-119 | P2 | open | **The game will be translated** (owner 2026-10-08). Pick how player-facing text is stored (a strings file per language and a lookup), then new UI keeps its text there; converting existing text waits for after the crunch. Until it exists, keep each new screen's text together, not scattered through logic. | ideas.md |
| T-124 | P2 | open | **Credits register** (owner 2026-10-08): a `CREDITS.md` listing every third-party asset pack in `public/assets/` (today Kenney RPG audio and three ZapSplat packs in `audio/sfx/`, plus `audio/bgm/`), its licence file and the exact attribution wording the licence asks for. Whoever adds an asset adds its line. An in-game Credits screen comes before release. | concept_tone_and_world.md |
| T-128 | P3 | open | The Guild Hall upgrade screen fits its web into a box that hides its overflow (`GuildHallBoard.jsx`, `overflow-hidden`), the pattern that let focus scroll the playmat 30 px under the top bar (fixed on the mat with `overflow-clip`, brief 50 D2). Check whether a node there can scroll it; if so, the same one-class fix. *Unverified.* | brief 50 D2 |
| T-131 | P3 | open | The tutorial beacon reads its target's box every animation frame while it is mounted (`TutorialBeacon` in `src/ui/components/base/TutorialAideOverlay.jsx`: a `requestAnimationFrame` loop calling `getBoundingClientRect`), which forces a layout in any frame where something changed style. Two mount while the recruit-hero quest is active, the bench's S2 board included. Traced on S3 at `7773c43c` (CPU profiler on): 4–6 ms in each drag's pickup and drop windows, the layouts it forces included; not measured on its own outside a drag. Follow the target with a `ResizeObserver` and the few animations it must track instead. | brief 50 D3 |
| T-132 | P2 | open | **A press on a flag where a hero's figure overlaps it sometimes misses.** `bench:drag` flag → mat, 0–4 of 50 drags a run since D2: either nothing is picked up (the flag's own hero under the pointer: 3 of 50 at `e25a0b2d`, 4 of 50 on S3 at `1bd6352c`) or the overlapping hero's flag is (1 of 50 on S2 and 2 of 50 on S3 at `7773c43c`). Not known yet whether the press lands on the hero's drawn pixels (the game is right; the bench chose a covered point, perhaps as the hero walked in) or its see-through ones (a game fault). Make the bench record the hero art's alpha at the press point, then decide. | brief 50 D3 |

### Cleanup — dead code, vestiges, lint *(safe, invisible; delete tests only with the code they test)*

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
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
| T-093 | P3 | open | Stale comments found by the GDD survey (2026-10-06): skill/job headers say 27 skills and 6 held (29; 9/11/13 held); `RegenSystem` says only idle heroes regen (also working and fighting); `BoardCombat.tickToken` says enemies never aggro (hostiles do); `reachRegistry` says Near = 8 tiles on a 6×6 board (164 u, 4 sides); `MatCap.js` says nothing enforces the cap (Shop and recipes do); `Restrictions.js` mentions the Vault; `constants.js` says yield/work-time/input-cost axes are unread; `recipePoolRegistry` says 3 recipes; `tempoBands`/`dials` say nothing reads them; `BubbleMenu` says 5 bubbles; `ConsumptionSystem` describes the deck loop; `loopConstants` mentions 100×. | GDD survey |
| T-094 | P3 | open | Dead-code leftovers after hygiene W3 (2026-10-07): functions now used only by tests (`resolveYield`, `getYieldMultiplier`, the other two `EffectAxes` helpers); Villager remnants (`isVillager` branches in `EquipmentValidator`, `HeroRehydration`, `PromotionSystem`, `SkillSystem`); `HeroDockTab`'s unused `onClick` prop; inert `effectFilesGlob`/`recipePoolFilesGlob` in `DatabaseManager.js`. `Placement.removePlacedToken` is kept (benches and tests use it). | GDD survey, W3 |
| T-108 | P3 | open | `cardUseCounts` (counts completed cycles per Token type; `GameState.js`, `BoardRunner.js`) is a deck-era name; rename it after the parked `atlas-wip` branch is merged or dropped (its `StateSchema.js` edit declares the field). | hygiene W4 |
| T-095 | P3 | open | The tutorial beacon for "Plant a Flag" probably targets nothing: its selectors (`#rightmost-hero-dock`, `#hero-dock`) match no element in the bottom dock. *Unverified — check in the game.* | GDD survey |
| T-103 | P3 | open | Comment-slimming leftovers: `src/state/StateSchema.js` (held back, owner's Atlas edit uncommitted), 2 comments in `cms/src/components/editors/RulesLine.jsx`, `cms/src/engine/sim/dryRun.mjs` header, `filterTargetTiles` named in `reachRegistry.js:26,136` (now `filterTargets`), ~15 test comments clipped by the ID stripper (e.g. `AdjacencyEffects.test.js:82`), and trailing string text carrying IDs (`workSkillRule.js` WORK_SKILL_WHY, `lifecycleAudit.js`, `matTuning.js` hints). Also dead exports found: `PERSONALITY_TAGS`, the three tutorial selectors in T-095. | Slimming pass |

### Build, tests, docs

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-065 | P2 | open | 3 of 7 test fixtures still borrow real `item_` ids — their rename changes the bench fingerprint, so land it as its own accepted commit. | CR3-551 |
| T-067 | P3 | open | Skipped tests: the Map-burst rule skips still need a ruling or deletion. | CR3-554 |
| T-068 | P3 | open | Build ships and preloads scrap art (`archive`/`maybe`/`waste`); keep it out of the build and the preload list. | CR3-508 |
| T-069 | P2 | open | Write the mat-era guide to keeping it fast in `docs/reference/PERFORMANCE.md` (the baseline and how-to-measure parts exist since 2026-10-07; draft in `docs/archive/review_v3/R6.md` §8 + `R7.md` §4). | CR3-021 |
| T-070 | P3 | open | Document `window.Game` — agents rely on ~30 entries the game never reads. | CR3-040 |
| T-111 | P3 | open | Engine bench timings are load-sensitive: on unchanged `main` (`933d12db`, 2026-10-08) a run beside a busy agent read 1.2–2.3× slower on every line; the next run alone matched the baseline on every p50 (0.94–1.05×) with only two p99 tails over 20 %. Treat REGRESSED as noise until reproduced on a quiet machine; the work check is reliable. | T-109 merge gate |
| T-115 | P3 | open | Player-facing Logging wording after the Forestry rename: the tutorial step "Log an Oak Tree / Let your Hero log 3 times" (`tutorialQuests.js`), and the ceremony line "Requires the skills it carries forward at level N" (`PromotionTrade.jsx`), now wrong for basic classes, which gate on two Starting skills. Visible text: owner eye-check (fits brief 30). | brief 20 R2a/R3 |
| T-116 | P3 | open | The CMS content generator still writes the retired task/area effect vocabulary (`targetCategory` enum ALL/COMBAT/MELEE/MINING/INDUSTRY/NATURE/CRAFTING in `contentGenerator.js`); only its skill list follows the registry. Revisit if the generator is revived. | brief 20 R3 |
| T-117 | P2 | open | The desktop app keeps drawing at ~165 fps while minimised (measured 2026-10-08: WebView2 is never told); pause drawing on Tauri's minimise event. Battery and GPU waste. | brief 40 O1 |
| T-118 | P3 | open | `npm run bench -- --cpu-prof` writes the module-loader thread's idle profile on Node 24 (`bench/run.mjs` `runWorker` uses a fixed `--cpu-prof-name`); drop the name or add the thread id. Workaround: plain `node --cpu-prof` (bench/README.md). | brief 40 O1 |
| T-121 | P3 | open | Slot card playtime reads hours for seconds: `formatPlaytime(seconds)` in `SlotSelectionModal.jsx` is handed milliseconds (76 s shows as 21h 6m). | brief 40 O4 |
| T-122 | P3 | open | `HeroEditModal` still embeds `HeroSkillSheet` with its own skill list, duplicating the H2 hero panel; `VitalBar.jsx` may have no consumers left. | brief 30 H2 |
| T-124 | P2 | open | Speech bubbles from different sources (a hero's bubble and the Token's bubble while the hero works it) can cover each other; they should stack smoothly like the bubbles of one source. Owner 2026-10-09. | eye-check B |
| T-114 | P3 | open | Remove `migrateSkillIds` (the `logging` → `forestry` content migration in the game loaders and the CMS store) once the owner has synced `data/` with `forestry`. | brief 20 R0 |

## 3. Parked — don't work on these without a reason

*Latent = the code is wrong but no shipped content triggers it. Fix it, test
first, when content that uses it is authored.*

| ID | Why parked | Summary | Origin |
|---|---|---|---|
| T-071 | Envelope | Canvas mat. Certification (2026-10-07): the realistic board passes, ~320 Tokens reaches 83 % of frames in budget. Unnecessary at realistic sizes; decide with the Performance Envelope whether boards that large must be smooth. | CR3-355 |
| T-110 | Atlas | Map code is idle now that no Maps ship (`data/maps.json` is `{}`): `mapRegistry.js` (`listMaps` used only by tests), the Map checks in `ContentAudit.js`, Map loading in `DatabaseManager.js`, the `mapId` branch in `tokenTypeDerivation.js`, CMS `MapEditor`/`mapPass`. Delete or reuse when the Atlas lands; don't touch before. | T-109 |
| T-072 | after the crunch | `@ts-check` trial on the contract layer. | CR3-560 |
| T-073 | latent | Input-cost discount applied when paying, not when checking. | CR3-028 |
| T-074 | latent | Item rules can be given moments that never fire. | CR3-202 |
| T-075 | latent | Rule upkeep pays from the Bank only (spawner upkeep is fixed by TL-20). | CR3-204, FB §5.4 |
| T-076 | latent | Each cure reaches only one of the two effect systems. | CR3-251 |
| T-077 | latent | Timed effects lose combat numbers on reload; use game time, not the wall clock. | CR3-252 |
| T-078 | latent | Loadout re-expanded on every axis read. | CR3-253 |
| T-079 | latent | Loading rewrites the Guild Hall's definition. | CR3-257 |
| T-081 | latent | Engine init isn't safe to run twice — only matters with a "back to title" feature. | CR3-108 |
| T-082 | latent | Shop's unreachable refund path skips mat events. | CR3-206 |
| T-083 | re-check | Synchronous subscribers; several whole-mat rebuilds per tick. Probably closed by Wave 3b — re-measure before working on it. | CR3-102 |
| T-084 | not needed | Push solver all-pairs (S4 worst push ~15 ms vs 8). Only matters past ~250 Tokens; T-035 may make it moot. | CR3-152 |
| T-086 | needs a Codex screen | Enemy kill counts never recorded. | CR3-035 |
| T-087 | owner-deferred | Desktop-shell group (save export, `src-tauri`). | CR3-046 |
| T-088 | Stage 2 | Randomness is unseeded and has no injectable source. | CR3-044 |
| T-089 | Stage 2 | Hero state lives in seven stores. | CR3-561 |
| T-090 | Stage 3 | Terrain can't be added through the CMS. | CR3-564 |
| T-091 | Stage 3 | Tokens teleport; mat size is dev tuning. | CR3-565 |
| T-092 | design | The free-playmat plan's "Map stays unopened" overflow rule (FP-46) is unbuilt; overflow drops as loot. | FMR |
| T-100 | before release | Master volume defaults to 0 so the owner can work in silence; set an audible default before shipping. | GDD §16.10 |
