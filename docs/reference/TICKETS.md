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

**Next free number: T-251**

---

## 1. Waiting on the owner

| ID | What | Origin |
|---|---|---|
| T-007 | **Coal Vein at 4 s**: accept, re-tag its purpose from gold to items (~3 s), or leave for the simulator rework? | FB §5.1 |
| T-008 | **Flag Radius upgrade art**: keep borrowing the plain hero flag, or use the red banner art? | FB §5.2 |
| T-010 | **Speech bubble audit**: add/remove list for `docs/reference/speech_bubble_lines.md`. | FB §5.5 |
| T-011 | **Watch by eye** (no agent has seen these on screen): Token hit animations + transform glow, loot flight to the Hall, Shop drawer, countdown badge. | FB §5.6 |
| T-012 | **Transforms now push neighbouring Tokens** (the playmat plan said only bursts and spawns push). Keep or change? | FMR |
| T-013 | **The last ~65 alert-icon glows and ~105 label text-shadows**: switch them to the hard-pixel style too? Also covers the soft drop shadows on the state badges (recipe gear, warnings, the −1 number), which each take a drawing layer while shown (owner 2026-10-15: settle them in this ruling). | CR3 summary; T-145 |
| T-014 | **Quest content is written in engine code** (the tutorial chain, `tutorialQuests.js`), not the CMS. Move it to content? (Design call, never asked; Atlas A8 rewrites the chain.) The opening half is closed: the Starter Camp is content (Atlas A7). | CR3-515 |
| T-127 | **Markets are cut for now** (owner 2026-10-09, D2): the Shrimp Market Token runs but pays nothing. Retire or repurpose it in the CMS (it turns up from Shrimp Coast content). The GDD §16 question is closed. | concept_progression.md |

## 2. Open work

### Engine

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-176 | P2 | open | **The quest board** ([concept_quests_tutorial.md](../active/concept_quests_tutorial.md), "The quest board", owner 2026-10-20): one fixture board at the bottom-left of every Region's mat; click opens its card on the quest list; up to 3 collect/hunt bounties from reachable content, Bank have/need, Claim takes items and bursts materials as floating loot; tutorial step pinned first; gold outline and ready count at rest. Replaces the loose quest Tokens. Brief 170. | owner interview |
| T-175 | P2 | owner | (Concept still a draft, owner 2026-10-14: not for the director yet.) **Collectors: the Guild Hall and warehouses** ([concept_collectors.md](../active/concept_collectors.md)): the Hall collects all loot in a small radius from the start, widened by a ranked Hall star; warehouses built on Foundations collect items with one tag (CMS Collects block: tag, radius, interval ~60 s), bigger radius on higher tiers, no upkeep; shared sweep clock, nearest collector wins, items fly in; Bank-full leaves loot and shows the yellow mark; reach ring on hover, drag, placing. Remove the auto-collect setting. Engineer. WORK CHANGED expected. Cost-log line. Eye-check. | concept_collectors.md |
| T-245 | P3 | open | **Carried rules read as Token rules in the Rules editor** (found by brief 220 C3, 2026-10-24): an item's rule on the fight-start moment shows as "On Neighbour's Fight" targeting "heroes on nearby Tokens"; give carried rules their own wording ("When this hero's fight starts", "to the hero") in `statementText.js` / the trigger picker. Builder-lite. No eye-check (CMS wording). | brief 220 C3 |
| T-246 | P3 | open | **The item tooltip shows a weapon's styles, damage and speed** (found by brief 220 C2, 2026-10-24): the Bank tooltip lists name, type and effects but not `styles`, `damage`, `speed` (fast/normal/slow) or two-handed. Builder-lite; wait for C6's enemy card so both read the same. | brief 220 C2 |
| T-248 | P3 | open | **Enemies stroll with their art over the mat edge** (found 2026-10-24 diagnosing the AtlasTravel flake): `EnemyMotion.js` ~236 clamps a stroll to the mat by its centre only (`clampToMat`), so up to 64 u of art hangs past the edge; a reload or travel then hops it inward (`MatResize.fitToMat`). Fix: clamp by the whole footprint (`MatPlacement.clampInside`; check for an import cycle). WORK CHANGED expected; small look change near edges. Engineer or builder. | flake diagnosis |
| T-249 | P2 | owner | **After a kill, the next camp enemy swings first** (found 2026-10-24): the kill ends the tick before the enemy swing timer moves and the post-kill pause does not reset it, so the next enemy hits about 2.9 s before the hero (live; 3.0 s in catch-up steps vs 2.1 s live). Owner question (asked with the next batch): reset both swing timers when the pause ends, or keep. | flake diagnosis |
| T-250 | P3 | open | **Seed Math.random for every test**: the game never seeds it; tests that run fights or strolls are luck-dependent unless they seed by hand (and `EnemyMotion`/`HeroMotion` keep their own copy, needing `setRandomForTests`). A vitest setup file that reseeds before each test would end this class of flake. Builder. | flake diagnosis |
| T-026 | P3 | ride-along | Small per-tick allocations in combat and statuses. | CR3-032 |
| T-027 | P3 | ride-along | Motion ticks allocate small objects per walker. | CR3-153 |

### Brief 210 — the backlog intake (owner 2026-10-22, Backlog director)

Detail, order and tiers in [brief 210](../active/briefs/210_backlog_intake.md); the owner's words in `docs/active/research/backlog_intake_2026-10-22.md` (intake codes in brackets).

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-243 | P3 | open | **Mat callouts and hero speech bubbles in the pixel family**: reframe the speech-style popups (hero speech bubbles, mat callouts, the off-mat refusal callout) to match the bubble row once T-239 is built. Builder. Eye-check. | brief 210 F1 audit |
| T-244 | P3 | open | **Nav orbs (and the station gear button): no hover glow or scale** (UI_STYLE: hover is a 1-art-pixel white outline; no glows, no scaling); the gear badge's `hover:scale-110` too (found by T-247). Builder-lite. Eye-check (one capture). | brief 210 F1 audit |
| T-251 | P3 | open | **Slow file-scanning tests time out under load**: `EngineEventNames` (CR3-107 runs 4.6 s alone against vitest's 5 s limit) and the source-scanning tests (`UiLayers`, `OneTooltip`, `GoldRetired`, `ContentIdsInCode`, `TextInCodeMatchesScreen`, `TimeBankRetired`, `RulesUseGameClock`, ...) fail at random when the full suite runs beside a build or another director's agents, then pass alone (seen many times 2026-10-23/24). Give the scanning tests a longer timeout or a shared cached file walk. Builder-lite. | Backlog director |

### UI

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-162 | P3 | ride-along | **Pixel sprites replace vector icons** (lucide: chevrons, X, zap, sparkles, help circle and others) as each screen is touched; missing sprites get a placeholder and a line in `owner_art_list.md`. | UI_STYLE.md (2026-10-13) |
| T-150 | P3 | owner | **Smaller hero flag**: swap to the owner's 32 px flag (today's are 64 px in `public/assets/ui/flag/`; waiting on the 32 px art) and fade the flag to half opacity while its hero works. Colour-blind cues (T-151) are separate. Eye-check. | refinement_pass_todo.md §3, ideas.md |
| T-151 | P3 | owner | **Colour-blind-safe hero flags**: safe colours plus a second cue (pattern or initial). Needs an owner choice and maybe art. | ideas.md |
| T-157 | P3 | open | **Quick Settings landing tab** in Settings: Master, Music and SFX volume, Animations, font and text size, Item Fly Particles, Auto-save interval (owner 2026-10-13). The same controls stay in their own tabs. Eye-check. | refinement_pass_todo.md §2 |
| T-138 | P3 | owner | **Sprite-strip player for owner-drawn effects**: play a horizontal strip once at a mat point on the strike frame / event (like `AnimatedHeroSprite.jsx:57-76`); a new `assets/fx/` folder added to the spriteFx generator's skip list (`spriteFx.js:77-80`). Waits for the owner's first effect art (owner_art_list.md). | research/animation_menu.md |
| T-119 | P3 | open | **Convert existing screens to the strings file** (format, lookup and TEXT.md built 2026-10-20, 9a103fbb: `src/i18n/en.json`, `t()`, `docs/reference/TEXT.md`; new UI uses it). The old screens convert in a later pass. | ideas.md |

### Cleanup — dead code, vestiges, lint *(safe, invisible; delete tests only with the code they test)*

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-140 | P3 | open | **The Map check's dials and refusals are read by nothing** since Atlas A5 retired `mapPass.js`: in `cms/src/engine/sim/dials.js` `mapScrapRatio`, `mapProductiveReturn`, `rarityPremium`, `rarityWeights`/`RARITY_WEIGHTS`, `scrapRatioAt`, `productiveReturnAt`, `pinnedAt`; `dayInReach` in `xpPass.js` (and `hoursPerDay` if the Pace dials no longer need it); the seven `map-*` codes in `refusals.js`; their fields in the CMS Settings modal. Delete with their tests (`EconSimXP`'s `dayInReach` cases; `EconSimLevers`' Map-card test flips back to absent). Also `checkPass.js` skips unlimited Tokens because the Map check used to name them: nothing names them now. | Atlas A5 |
| T-141 | P3 | blocked | **Content audit: a respawning node still sold at the Shop** (roadmap A5 lists it): warn when a Token with A2's Respawns block also has a `shop` block. Blocked on A2 merging (its block shape). One rule in `lifecycleAudit.js`, so the boot check and the CMS Economy Audit share it. | Atlas A5 |
| T-054 | P3 | open | Class names that match no stylesheet: `animate-in`/`fade-in`/`zoom-in-95` (no `tailwindcss-animate`), `custom-scrollbar`, `gi-scrollbar`. The unused z-index tokens went in 87a461a2; the unloaded stylesheets were already gone. | CR3-465 |
| T-056 | P3 | open | Rename `DeckDndProvider`/`DeckDndContext` (about forty test files import them). The tile accessors, unused constants, tray particle fields and dead particle lookups went in 70590720. | CR3-504, 408 |
| T-057 | P3 | open | Rename tile-named engine vocabulary — code names and event strings together, one slice. | CR3-501 |
| T-058 | P3 | open | Lint residue (~74 old errors), per area: engine, combat (keep `MERGE_GRACE_MS` at 1100), UI↔engine (don't add hook deps blindly), renderer, UI. | CR3-110, 265, 312, 359, 467 |
| T-059 | P3 | open | The CMS imports `itemRegistry` for one constant. | CR3-511 |
| T-060 | P3 | blocked (soak) | Toasts may leave page elements behind. A 60-minute soak decides: certification Part G (`docs/archive/certification_checklist.md`), or automate it with the drawing bench's Chrome driver. | CR3-039 |
| T-063 | P3 | open | `resolveAnimationPath` hard-codes an id map and uses a relative `assets/` path. *Unverified since 2026-09-21.* | FMR |
| T-094 | P3 | open | Villager remnants: `isVillager` branches in `EquipmentValidator`, `HeroRehydration`, `PromotionSystem`, `SkillSystem`, and the QA panel's filters. Held back while the rules and UI branches edited those files. The test-only effect helpers and inert globs went in 40123429. | GDD survey, W3 |
| T-108 | P3 | open | `cardUseCounts` (counts completed cycles per Token type; `GameState.js`, `BoardRunner.js`) is a deck-era name; rename it after the parked `atlas-wip` branch is merged or dropped (its `StateSchema.js` edit declares the field). | hygiene W4 |
| T-103 | P3 | open | Comment-slimming leftovers: `src/state/StateSchema.js` (review ids and history; `atlas-wip` still parks an edit there), `cms/src/engine/sim/dryRun.mjs` header, ~15 test comments clipped by the ID stripper (none found by pattern). Tuner hints, WORK_SKILL_WHY, the reachRegistry names and `PERSONALITY_TAGS` done in 2c116882. | Slimming pass |

### Build, tests, docs

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-067 | P3 | open | Skipped tests: the Map-burst rule skips still need a ruling or deletion. | CR3-554 |
| T-116 | P3 | open | The CMS content generator still writes the retired task/area effect vocabulary (`targetCategory` enum ALL/COMBAT/MELEE/MINING/INDUSTRY/NATURE/CRAFTING in `contentGenerator.js`); only its skill list follows the registry. Its prompt also still teaches energy costs and the per-level skill multiplier (`contentGenerator.js`, `useGlobalStore.js` defaults), both retired. It is still reachable from the CMS's Generate button, so rewriting the prompt is a design call, not dead code. | brief 20 R3 |
| T-114 | P3 | open | Remove `migrateSkillIds` (the `logging` → `forestry` content migration in the game loaders and the CMS store) once the owner has synced `data/` with `forestry`. | brief 20 R0 |

## 3. Parked — don't work on these without a reason

*Latent = the code is wrong but no shipped content triggers it. Fix it, test
first, when content that uses it is authored.*

| ID | Why parked | Summary | Origin |
|---|---|---|---|
| T-071 | Envelope decided: parked (owner 2026-10-21) | Canvas mat. Envelope (GDD §14): Tokens are the cheapest thing on the mat (about 1 ms at 128); fix the moving things first (T-197 to T-201). Reopen only if 256 must be smooth on a slow laptop. | CR3-355 |
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
| T-197 | P2 | open | **Loot piles' hover animation is almost all their cost** (Envelope): 38 piles read 72.2 % on the slow laptop vs 91.7 % with the hover stopped. `src/ui/components/base/TokenSprite.jsx:182` (`gi-sprite-hover`), `src/tailwind.css:330`. Options: hover only the newest few, step all piles on one shared clock, or stop once a pile has rested. Owner: keep the cap of 40. Engineer. Eye-check. | brief 90 |
| T-198 | P2 | open | **Bubbles are the largest cost per hero and per fight** (Envelope): 16 heroes 3.4 of 12.0 ms; 7 fights 5.2 of 15.7 ms. Find which part (health bar, work ring, frame) with a finer switch and make it cheaper; secondary: hero animation (2.5 ms), hero bar (1.8 ms) at 16 heroes. Engineer. Eye-check if the look changes. | brief 90 |
| T-199 | P2 | open | **24 h catch-up misses 30 s at 256 Tokens (38.3 s) and about 70 enemies (35.6 s)** (Envelope; the owner keeps the 256 cap, so this must be fixed). At ~4x it takes 6.4x its full-speed time; check the 50 ms slices' yields and the catch-up bar. `CatchUp.run`, the tick handlers; profile with `bench/catchup/time.mjs --scene`. Engineer. | brief 90 |
| T-200 | P2 | open | **Wandering enemies are expensive in the engine and on the mat** (Envelope): the tick's slowest 1 % reaches 11-23 ms at ~4x with long frames of 85-137 ms; about 70 enemies bite even at 1x. `EnemyMotion`, enemy drawing. Engineer. | brief 90 |
| T-201 | P2 | open | **Drags on the 128 board at ~4x fail smooth's drag test by about 2x** (Envelope: pickup 55-61 ms, drop 73-109 ms vs 33.4 ms). Continue T-033's next steps: dnd-kit context changes, the drop animation's measuring. Engineer. | brief 90 |
| T-202 | P3 | open | **The stub column keeps every row mounted** (about 0.1 ms per row, Envelope): `ItemStubColumn.jsx`; render only the visible rows, or make rows cheaper. Builder. | brief 90 |
| T-203 | P3 | open | **The `camp128` bench board's premise is stale** (it assumes 25 endgame sites outside the cap; `MatCap.countsTowardCap` and GDD §3/§16 count landmarks): fix `bench/scenarios/cap.mjs`, the `stressScenarios.js` label, `bench/README.md` and PERFORMANCE 'Smooth, defined'; rename it cap153 or retire it. Builder-lite. | brief 90 |
| T-204 | P3 | open | **GDD §3 says the Token Cap upgrade is not built yet**, but `guildUpgrades.js` has the `token_cap` node (+16 a rank up to 256). Docs. Builder-lite. | brief 90 |
| T-205 | P3 | open | **Chrome's CPU throttle drifts** (asking 4x delivered 4.1-5.2x on 2026-10-21; the draw baseline retake was refused for it): `--slowdown-target` exists only in `bench:draw`; `bench:drag`, `bench:profile`, `bench:crisp` and the catch-up bench need it (or automatic calibration), and drag/profile/crisp don't accept the envelope scenes (`sceneFor`). The drag bench also skipped the Bank kind on cap128 ('no equippable item tile visible'). Builder. | brief 90 |
| T-206 | P3 | open | **Stale bench Chrome profiles and orphan processes**: 22 `fg-bench-chrome-*` profiles in the temp folder since 2026-10-10; killing the npm wrapper leaves `draw.mjs` and Chrome running. Clear stale profiles at bench start; document how to stop a bench. Builder-lite. | brief 90 |
| T-207 | P3 | open | **Smooth's second line is effectively pass/fail** on the headless 165 Hz clock (the 1-in-1,000 frame within 33.4 ms: 30.3 ms passes, 36.4 ms fails). Restate it as 'at most 5 frames', or lean on the 16.7 ms share plus the long-frame count. Director, with the owner. | brief 90 |
| T-208 | P3 | open | **Flaky tests under full-suite load**: `src/tests/CMSChangePackReview.test.js` (a `waitFor` timeout; passes alone 3/3) and `EngineEventNames.test.js` CR3-107 (its source scan has no timeout option while its neighbour has 20 000). Builder-lite. | brief 90 |
| T-209 | P3 | open | **The 128 board at 1x read 97.2 % within 6.06 ms** in one window on 2026-10-21 vs 99.5 % on 2026-10-09: confirm with three windows in a quiet bench window; if real, find what moved it. Director. | brief 90 |
| T-210 | P3 | open | **Remove the description bridge** in `src/tests/fixtures/shippedAsLoaded.js` (`describeNeededTools`): the owner's re-sync (11512fbc) put the 'Needs a ... in hand.' clause into `data/`, so the bridge now finds nothing. Builder-lite. | brief 90 |
| T-196 | P3 | open | **Afterimages look wrong as white speckles** (owner 2026-10-21, eye-check of the animation batch): the hit and loot-hop afterimages are speckled white copies (`src/ui/components/board/fx/`, generated tinted pictures). Try the sprite's own colours speckled, or another look, on the style sheet page first; refinement pass. Eye-check. | T-137 |
| T-195 | P3 | open | **Three one-line leftovers in the terrain director's files** (engine plumbing, 2026-10-21): `src/systems/atlas/Atlas.js:516` still publishes `STATE_CHANGED` after its own `GAME_RESET` (delete it, then `STATE_CHANGED` from `engineEvents.js` and its `NO_LISTENER` entry, and tighten `StateChangedRetired.test.js`); `src/systems/atlas/layoutInputs.js:25` reads `matTuningDefault('matSteps')` and should read `MAT_STEPS` from `matGeometry.js`. Also (2026-10-21): `src/ui/dev/terrainDev.js` (`DEV_GROUND_TOKENS`) has the Test Boat borrow `token_fishing_net`'s look, and the tools content sync deleted that Token; repoint it to a live Token and remove its `KNOWN_DEAD` entry in `ContentIdsInCode.test.js`. Terrain director. | T-015, T-097 |
| T-193 | P3 | open | **A notification log** (owner 2026-10-19: low priority, build only if it proves needed; [concept_notifications.md](../active/concept_notifications.md) "Later: the log"): opens as a modal; plain-text rows like the item stubs, no sprite; a new-items dot, no count. Builder. Eye-check. | brief 150 |
| T-189 | P3 | open | **Retire `data/palettes/materials_library.json`** (found 2026-10-16): 12 lower-case ramps the Studio only reads (a GET in `RecolorEditor.jsx`), looked up only when a swap target matches a lower-case key exactly, which the dropdown never offers. Confirm nothing needs it, then remove the read and have the owner delete the file through the Studio/CMS. builder-lite. | T-180 palette bake |
