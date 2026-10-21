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

**Next free number: T-197**

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
| T-026 | P3 | ride-along | Small per-tick allocations in combat and statuses. | CR3-032 |
| T-027 | P3 | ride-along | Motion ticks allocate small objects per walker. | CR3-153 |

### UI

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-162 | P3 | ride-along | **Pixel sprites replace vector icons** (lucide: chevrons, X, zap, sparkles, help circle and others) as each screen is touched; missing sprites get a placeholder and a line in `owner_art_list.md`. | UI_STYLE.md (2026-10-13) |
| T-150 | P3 | owner | **Smaller hero flag**: swap to the owner's 32 px flag (today's are 64 px in `public/assets/ui/flag/`; waiting on the 32 px art) and fade the flag to half opacity while its hero works. Colour-blind cues (T-151) are separate. Eye-check. | refinement_pass_todo.md §3, ideas.md |
| T-151 | P3 | owner | **Colour-blind-safe hero flags**: safe colours plus a second cue (pattern or initial). Needs an owner choice and maybe art. | ideas.md |
| T-157 | P3 | open | **Quick Settings landing tab** in Settings: Master, Music and SFX volume, Animations, font and text size, Item Fly Particles, Auto-save interval (owner 2026-10-13). The same controls stay in their own tabs. Eye-check. | refinement_pass_todo.md §2 |
| T-138 | P3 | owner | **Sprite-strip player for owner-drawn effects**: play a horizontal strip once at a mat point on the strike frame / event (like `AnimatedHeroSprite.jsx:57-76`); a new `assets/fx/` folder added to the spriteFx generator's skip list (`spriteFx.js:77-80`). Waits for the owner's first effect art (owner_art_list.md). | research/animation_menu.md |
| T-136 | P2 | open | **Pixel frames on every panel** (owner 2026-10-09, UI_STYLE "Pixel frames"): one shared frame class with `border-image` nine-slice, **studs** for big docked panels, **chamfer** for small floating ones, one colour, hard 2-art-pixel shadow; the two 7×7 pictures are the ones in `docs/active/research/pixel_borders_demo.html` (extract the data URIs to PNGs in `public/assets/ui/`; new files, not the owner's uncommitted art). Replace rounded corners, translucent hairlines and blurred shadows; unbox the rows UI_STYLE forbids (`TokenInspection.jsx:132,147,221`, `ShopDrawer.jsx:299`, `HeroSkillSheet.jsx:93`); tooltips first (`Bubble.jsx`, `TopBarTip.jsx`, `QuestTooltip.jsx`, `MatCapBadge.jsx` share classes), then sidebars, Token inspect, drawers, modals, toasts. Builder. Run when no crunch brief is editing those components; cost-log line (`bench:draw --compare`); changes the look: owner eye-check. | research/pixel_borders.md |
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
| T-071 | Envelope | Canvas mat. Certification (2026-10-07): the realistic board passes, ~320 Tokens reaches 83 % of frames in budget. Unnecessary at realistic sizes; decide with the Performance Envelope whether boards that large must be smooth. | CR3-355 |
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
| T-196 | P3 | open | **Afterimages look wrong as white speckles** (owner 2026-10-21, eye-check of the animation batch): the hit and loot-hop afterimages are speckled white copies (`src/ui/components/board/fx/`, generated tinted pictures). Try the sprite's own colours speckled, or another look, on the style sheet page first; refinement pass. Eye-check. | T-137 |
| T-195 | P3 | open | **Three one-line leftovers in the terrain director's files** (engine plumbing, 2026-10-21): `src/systems/atlas/Atlas.js:516` still publishes `STATE_CHANGED` after its own `GAME_RESET` (delete it, then `STATE_CHANGED` from `engineEvents.js` and its `NO_LISTENER` entry, and tighten `StateChangedRetired.test.js`); `src/systems/atlas/layoutInputs.js:25` reads `matTuningDefault('matSteps')` and should read `MAT_STEPS` from `matGeometry.js`. Also (2026-10-21): `src/ui/dev/terrainDev.js` (`DEV_GROUND_TOKENS`) has the Test Boat borrow `token_fishing_net`'s look, and the tools content sync deleted that Token; repoint it to a live Token and remove its `KNOWN_DEAD` entry in `ContentIdsInCode.test.js`. Terrain director. | T-015, T-097 |
| T-194 | P3 | open | **Reuse the camera glide for the Guild Hall upgrade screen** (owner 2026-10-20): the glide from the mat up a shared wood table to the Atlas book was built (brief 160 T4a: `AtlasCamera.jsx`, one transform on one wrapper, skippable, reduced motion swaps; the mat never re-renders) and set aside when the Atlas became a pop-up. Kept at git tag `atlas-camera-move` (7a678567). Bring it back when the upgrade screen is built. | brief 160 T4a |
| T-193 | P3 | open | **A notification log** (owner 2026-10-19: low priority, build only if it proves needed; [concept_notifications.md](../active/concept_notifications.md) "Later: the log"): opens as a modal; plain-text rows like the item stubs, no sprite; a new-items dot, no count. Builder. Eye-check. | brief 150 |
| T-189 | P3 | open | **Retire `data/palettes/materials_library.json`** (found 2026-10-16): 12 lower-case ramps the Studio only reads (a GET in `RecolorEditor.jsx`), looked up only when a swap target matches a lower-case key exactly, which the dropdown never offers. Confirm nothing needs it, then remove the read and have the owner delete the file through the Studio/CMS. builder-lite. | T-180 palette bake |
