# Fantasy Guild — Code Review **Round 3** Findings

The tracker for [`code_review_v3_master_plan.md`](code_review_v3_master_plan.md).
Tickets are **`CR3-NNN`**. Read the plan's §6 for severity, category codes and
the priority score.

> **Plan approved — all six §9 questions answered (2026-09-27/28).** The
> tickets CR3-001…022 were filed during planning (2026-09-27) from **reading the
> code, not measuring it**. Every one says so. P2's benchmark confirms or closes
> them. CR3-023…046 come from P1 (2026-09-28): the tooling run and the round-2
> re-triage. **Round 2's tracker is archived — this file is the single truth.**

---

## Session Status *(update at the end of every session)*

| # | Session | State | Date | Commit | Notes |
|---|---|---|---|---|---|
| — | Planning survey | ✅ Done | 2026-09-27 | `6908bca` | 22 tickets pre-filed |
| P1 | Clean baseline & round-2 re-triage | ✅ Done | 2026-09-28 | *(this commit)* | 88 open CR2 tickets walked against the code: 37 closed, 4 CMS lane, 1 econ-sim lane, 2 closed by owner decision, 44 carried into CR3-018/020/024…046; tooling run filed CR3-023…027 |
| P2 | Build Tier A — headless benchmark | ✅ Done | 2026-09-28 | `42181be` | `npm run bench` + `bench:micro`; S2 misses target ~2×, S3 cliff; 4 tickets confirmed, 2 closed; CR3-047 filed |
| P3 | Build Tier B — stress scenarios + Perf HUD | 🔲 Not started | | | |
| R1 | Engine loop, clock & event bus | 🔲 Not started | | | |
| R2 | Board state & spatial physics | 🔲 Not started | | | |
| R3 | Work, flags & rule evaluation | 🔲 Not started | | | |
| R4 | Combat, heroes, effects & loot | 🔲 Not started | | | |
| R5 | UI ↔ engine boundary & render cascades | 🔲 Not started | | | |
| R6 | Mat renderer: paint, layout & composite | 🔲 Not started | | | |
| R7 | Drag & drop and input | 🔲 Not started | | | |
| R8 | UI/UX consistency across surfaces | ✅ Done | 2026-09-28 | *(wave-1 commit)* | 18 tickets CR3-450…467 (1 P1); 11 owner questions |
| R9 | Vestiges, documentation & layer separation | ✅ Done | 2026-09-28 | *(wave-1 commit)* | 16 tickets CR3-500…515 (0 P1); 5 owner questions |
| R10 | Expansion readiness & test coverage | 🔲 Not started | | | |
| C | Runtime certification (hands-on) | 🔲 Not started | | | |
| Z | Synthesis & fix waves | 🔲 Not started | | | |

---

## Baselines

### Planning snapshot *(indicative only — dirty tree)*

Branch `b9/hall-web`, HEAD `00c8550`, with another session's uncommitted work
in 7 files. `vitest run`: **3,691 passed / 15 failed / 29 skipped, 226 files.**

### Clean baseline — taken by P1, 2026-09-28

`main` at **`17fdcef`**. The working tree held two uncommitted palette edits
from another session (`data/palettes/*.json`); nothing in the game or its tests
reads those files (only the CMS's `RecolorEditor`), so they cannot affect these
numbers.

| Measure | Value | Round 2 close, for comparison |
|---|---|---|
| Tests | **3,731 passed / 10 failed / 29 skipped — 228 files** | 840 / 0 / 21, 58 files |
| The 10 failures | ContentRules (redberry band) 1 · EconSimRunner (anchor flag) 1 · EconSimTime (config-less rows) 1 · OneRuleOnePlace (Map materials) 1 · TerrainRegistry 6. **Same count as the 2026-09-26 recorded baseline** — all known, none new. | |
| `npm run lint` | **98 errors, 9 warnings in 82 files**: 70 `no-unused-vars`, 25 `no-undef` (**all in test files** — Node's `__dirname`/`process`/`require`, a config gap, not a game crash risk), 8 `exhaustive-deps`, 3 `no-useless-assignment` | 32–83 |
| `npm run cycles` | **4 cycle groups, 3 of them dangerous (all-static)** — see CR3-023 | **0 dangerous** |
| `npm run duplication` | 18 clones, 0.42 % of lines | 12 clones, 0.44 % |
| `node tools/reachability.mjs` | 240 of 499 files unreached, all but 6 are tests. Non-test: `nameRegistry.js` (barrel-only, known live), `tempoBands.js` + `statementSlots.js` (**live via `cms/src`** — the tool's lie #2), `terrainAssignments.js` (tests only), `HeroDockCard.jsx` + `DockSkillsGrid.jsx` (**genuinely dead**, CR3-024) | 66 of 232 |
| `npm run build` | **1,152 KB JS** (352 KB gzip) + 321 KB CSS, single chunk; 3 "dynamic import will not move module" warnings | 865 KB JS |
| `public/assets` | **38.6 MB, 1,102 files — and git-ignored** (CR3-027) | 11 MB |

⚠ **Lesson for later sessions:** a clean `git worktree` is **not** a faithful
test environment here. `public/assets/` and `cms/node_modules/` are git-ignored,
so 26 test files fail in a fresh checkout for reasons unrelated to the code.
Run the baseline in the real checkout and confirm the dirty files are unread.

### Performance baseline *(P2 and P3 fill this in)*

| Scenario | Tick p50 | Tick p99 | Tick max | Events/tick | Heap drift | Frame ≤ 6.06 ms | LoAF > 50 ms |
|---|---|---|---|---|---|---|---|
| S1 Quiet Hall | | | | | | | |
| S2 Realistic | | | | | | | |
| S3 Torture | | | | | | | |
| S4 Push storm | | | | | | | |
| S5 Rebuild storm | | | | | | | |
| S6 Long idle (8 h) | | | | | | | |

---

## Ticket Format

```
### CR3-NNN — one-line title
- **Category / Severity / Effort**: HPB · P2 · M
- **Impact / Confidence / Score**: 4 · 0.6 (reasoned) · 1.2
- **Risk**: low | medium | high  — needs test: CR3-xxx / none
- **Where**: path:line
- **What**: plain-language description
- **Evidence**: the code, and the NUMBER if measured (scenario, commit, machine)
- **Hypothesis to test**: (perf tickets) what the bench should show if this is real
- **Owner session**: R#
- **Status**: 🔲 Open · 🟡 Partly fixed · ✅ Fixed (commit) · ⚪ Moot (why)
```

---

## System Map *(each session fills in its territory)*

*(empty — R1 onward)*

---

## Findings

### Filed during planning — 2026-09-27

All **confidence 0.6 (reasoned)**, all **Status: 🔲 Open**, all **P2 until
measured** (plan §6.1).

---

### CR3-001 — The Token list is copied, filtered and sorted on every call
- **Category / Severity / Effort**: HPB+GC · P2 · M
- **Impact / Confidence / Score**: 4 · 0.6 · 1.2
- **Risk**: medium — callers may rely on getting a fresh array they can mutate; tie-break order by `placedAt` must be preserved exactly
- **Where**: `src/systems/board/BoardState.js:271-276`; ~40 call sites across `src/systems/board/`, `SpawnerSystem`, `MatCap`, `QuestTokens`, UI hooks
- **What**: `tokens()` does `Object.values → filter → sort` each call. It is called several times per tick (the board loop, enemy walking, each flag's search and its `tokenAtPoint`, spawner counts, the cap) and from UI selectors on every `state_changed`.
- **Hypothesis to test**: S2/S3 bench shows `tokens()` calls per tick in the tens and a measurable share of tick time and heap churn; a versioned cache (rebuilt on add/remove/move only) removes both.
- **Owner session**: R2

### CR3-002 — Every free flag re-searches the whole mat whenever the Bank changes
- **Category / Severity / Effort**: HPB · P2 · M
- **Impact / Confidence / Score**: 3 · 0.6 · 0.9
- **Risk**: medium — narrowing "dirty" risks a hero not noticing newly workable Tokens
- **Where**: `src/systems/board/Flags.js:1270` (dirty on `inventory_updated`), `evaluate` `:489-562`, `assign` `:749-771`
- **What**: any Bank change marks flags dirty; each un-claimed flag then scans every Token, sorts candidates and runs `WorkCheck.whyCannotRun` on each until one passes. With 8 heroes producing, the Bank changes almost every tick.
- **Hypothesis to test**: at S2 the Flags stage is re-evaluating most ticks; cost grows heroes × Tokens.
- **Owner session**: R3

### CR3-003 — No spatial index; the push solver is quadratic × 30 passes
- **Category / Severity / Effort**: HPB · P2 · L
- **Impact / Confidence / Score**: 3 · 0.6 · 0.45
- **Risk**: high — push results must stay identical or saved layouts shift
- **Where**: `src/systems/board/nearby.js` (`tokensWithin :75`, `tokensAround :138`), `MatPlacement.js` (`contextFor :148`, `relax :374-430`, `PUSH_PASSES = 30 :325`, `restockTargetAt :591`)
- **What**: every "what is near this point" walks every Token; the push solver compares every pair of bodies in its region up to 30 times.
- **Hypothesis to test**: S4 worst-case drop/shrink exceeds the 8 ms target at 300 Tokens; micro-bench growth curve is super-linear. **Do not fix unless measured** — at 40 Tokens this is likely fine.
- **Owner session**: R2

### CR3-004 — A board-reach aura makes every neighbourhood change a quadratic whole-mat rebuild
- **Category / Severity / Effort**: HPB · P2 · M
- **Impact / Confidence / Score**: 4 · 0.6 · 1.2
- **Risk**: medium — stale buffs were the top risk of Free Playmat 1.3; any fix must keep the "departure AND arrival" rebuild guarantee
- **Where**: `src/systems/board/TileModifiers.js:568-576` (`rebuildTokens`), `applicableStatements :341-380` (walks all Tokens per rebuilt Token), `boardReachOnBoard :536`; trigger: `EnemyMotion.js:230` publishes `ADJACENCY_DIRTY` at the end of every enemy stroll
- **What**: while any board-reach rule is on the mat, each `ADJACENCY_DIRTY` rebuilds every Token, and each rebuild scans every Token → Tokens² per event. Pottering enemies make these events continuous.
- **Hypothesis to test**: S5 shows `rebuildToken` calls per second in the thousands and a visible tick spike on each enemy arrival.
- **Owner session**: R3

### CR3-005 — Stalled Tokens re-publish their alert every tick
- **Category / Severity / Effort**: GC · P2 · S
- **Impact / Confidence / Score**: 3 · 0.6 · 1.8
- **Risk**: low — publish on change instead of every tick; check the alert component's fade/replay behaviour relies on nothing else
- **Where**: `src/systems/board/BoardRunner.js:640-700` (three `TILE_EVENT_ALERT` publishes with template-string payloads); UI routed by id in `src/ui/components/board/tokenEvents.js:77` → `TokenEventAlert.jsx:450`
- **What**: a Token waiting on inputs/charges/a neighbour builds and publishes a new alert object 10×/s; its handler re-runs for an unchanged message.
- **Hypothesis to test**: S2 events-per-tick table is dominated by `TILE_EVENT_ALERT`.
- **Owner session**: R1

### CR3-006 — Engine tick is on `setInterval`, unsynchronised with drawing
- **Category / Severity / Effort**: HPB · P3 · M
- **Impact / Confidence / Score**: 2 · 0.3 · 0.3
- **Risk**: high — changes timing of everything, and background-tab behaviour
- **Where**: `src/systems/core/GameLoop.js:40`
- **What**: not a bug — a design choice to revisit consciously. A heavy tick lands in an arbitrary frame; a frame-clock accumulator would let ticks be spread or deferred. Tied to plan Q1.
- **Owner session**: R1

### CR3-007 — Walking is animated with `left`/`top`, forcing layout every frame
- **Category / Severity / Effort**: PNT · P2 · S–M
- **Impact / Confidence / Score**: 5 · 0.6 · 3.0 *(highest pre-filed score)*
- **Risk**: medium — hit-testing, bubble placement and drag origins may read `left/top`
- **Where**: `src/ui/components/board/MatHero.jsx:122`, `MatToken.jsx:343-352`, `HeroBubbleLayer.jsx:196-201`
- **What**: CSS transitions on `left`/`top` re-run layout each frame of every walk; `transform: translate()` is compositor-only.
- **Hypothesis to test**: Performance panel at S2 shows recurring Layout in most frames while heroes walk; a spike converting to `transform` removes it.
- **Owner session**: R6

### CR3-008 — The whole mat re-renders 10×/s whenever anything walks
- **Category / Severity / Effort**: RC · P2 · M
- **Impact / Confidence / Score**: 4 · 0.6 · 1.2
- **Risk**: medium
- **Where**: publishers `HeroMotion.js:420`, `EnemyMotion.js:327`; listeners `MatBoard.jsx:84-110` (Tokens + re-sort), `:119-168` (heroes); only `MatToken.jsx` of 32 board components is `React.memo`'d
- **What**: walk events rebuild `MatBoard`'s lists every tick; `MatBoard` re-renders and re-sorts all Tokens. Enemies potter continuously, so this never stops.
- **Hypothesis to test**: Profiler at S2 shows `MatBoard` committing ~10/s with heroes idle-working and enemies present.
- **Owner session**: R5

### CR3-009 — `state_changed` runs one selector per Token, some of them whole-mat scans
- **Category / Severity / Effort**: RC+HPB · P2 · M
- **Impact / Confidence / Score**: 4 · 0.6 · 1.2
- **Risk**: medium — the CR-044 selector contract (`useGameState.js` header)
- **Where**: 31 `publish('state_changed')` sites; listeners `MatToken.jsx:167-210` (per Token), `MatBoard.jsx`; costly selector part: `SpawnerSystem.countOf :128-131` (per spawner Token, sorts the whole mat)
- **What**: one `state_changed` → N selectors + N deep-equals; spawner Tokens each walk the whole mat → roughly Tokens² per event.
- **Hypothesis to test**: Profiler + HUD at S3 show a long task per `state_changed` burst.
- **Owner session**: R5

### CR3-010 — Particle canvas clears and redraws every frame even when empty
- **Category / Severity / Effort**: PNT · P2 · S
- **Impact / Confidence / Score**: 4 · 0.6 · 2.4
- **Risk**: low
- **Where**: `src/ui/components/base/ParticleOverlay.jsx:114-123`
- **What**: `requestAnimationFrame` loop never sleeps; full-window `clearRect` + draw 165×/s with nothing to show. The 2026-09-16 handoff (§7) already noted "the renderer never idles".
- **Hypothesis to test**: empty-mat frame profile shows the loop in every frame; sleeping when there are no particles zeroes it.
- **Owner session**: R6

### CR3-011 — Many independent per-component timers instead of one frame clock
- **Category / Severity / Effort**: PNT+RC · P2 · M
- **Impact / Confidence / Score**: 3 · 0.6 · 0.9
- **Risk**: medium
- **Where**: `TokenBadgeRow.jsx:110-116` (a rAF loop per working Token), `AnimatedEnemySprite.jsx:81` (interval + React state per enemy per frame), polls in `FlagLayer.jsx:386`, `FlagRulesPanel.jsx:41`, `TurnRing.jsx:40`, `TrickleTooltip.jsx:73`, `HeroBubbleLayer.jsx:141`, `MatUpkeepBadge.jsx:91`, `UpkeepSummaryPanel.jsx:32`, `TokenInspection.jsx:347`
- **Hypothesis to test**: S2 frame profile shows many small timer callbacks per frame; count live timers in the HUD.
- **Owner session**: R6

### CR3-012 — Drop-shadow filters and filter transitions on every sprite
- **Category / Severity / Effort**: PNT · P2 · M
- **Impact / Confidence / Score**: 3 · 0.3 · 0.45
- **Risk**: medium — visual; owner must judge any change by eye
- **Where**: ~40 filter/blur uses; `MatToken.jsx:482`, `MatHero.jsx:136`, `SpriteLayerView.jsx:183`
- **Hypothesis to test**: at S3 the Paint/Raster share is large and scales with sprite count.
- **Owner session**: R6

### CR3-013 — UI publishes an engine board event
- **Category / Severity / Effort**: LAY · P3 · S
- **Impact / Confidence / Score**: 1 · 0.6 · 0.6
- **Where**: `src/ui/components/board/MatToken.jsx:247` publishes `TILE_EVENT_ALERT` on a missed Guild Hall drag
- **What**: a message, not a rule — probably acceptable. `boardEvents.js` should state which layer may publish each event.
- **Owner session**: R5

### CR3-014 — Loot timing uses the wall clock, not game time
- **Category / Severity / Effort**: CON · P3 · S
- **Impact / Confidence / Score**: 1 · 0.6 · 0.6
- **Where**: `src/systems/board/SpriteLayer.js:530`
- **What**: `Date.now()` inside a tick handler. Only matters under fast-forward; the Time Bank is out of scope by owner instruction. Recorded as a contract note.
- **Owner session**: R4

### CR3-015 — "Tray" vocabulary survives in 20 source files after the Tray was retired
- **Category / Severity / Effort**: VES · P3 · M
- **Risk**: medium — some may be save-compatibility and must stay
- **Where**: incl. `BoardState.js`, `StateSchema.js`, `DndKit.jsx`, `Restrictions.js`, `AssetPreloader.js`, `MatResize.js`, `playmatTuning.js`
- **Owner session**: R9 (classify: residue / save-compat / legitimate)

### CR3-016 — Tile-named engine API
- **Category / Severity / Effort**: VES · P3 · M
- **Where**: `TileModifiers.js`, `BOARD_EVENTS.TILE_CHANGED`, `TILE_EVENT_ALERT`, `ADJACENCY_DIRTY`; guard test `src/tests/FreeMatGuards.test.js`
- **What**: handoff §8.3 says the rename is now safe. ⚠ 393 *tile* hits in non-test source — many legitimate (terrain raster, Guild Hall 7×7 upgrade board, sprite sheets). Classify before renaming.
- **Owner session**: R9

### CR3-017 — Two placement modules: `Placement.js` and `MatPlacement.js`
- **Category / Severity / Effort**: DC? · P3 · S
- **Where**: `src/systems/board/Placement.js`, `MatPlacement.js`
- **What**: documented as rules vs geometry. Verdict needed: clean split, or duplicated responsibility.
- **Owner session**: R2

### CR3-018 — Stale agent guides and workflows
- **Category / Severity / Effort**: DOC · P2 · M
- **Where**: `.agent/guides/TILESYSTEM.md`, `crafting_cards_documentation.md`, `food_and_drink_technical_documentation.md`, `chaos_system_architecture.md`; `.agent/workflows/add-tile.md`, `add-card.md`, `add-playmat.md`; `.agent/handoff_hero_dock_food_equip.md`; 44 root + 46 `docs/` markdown files of mixed vintage
- **What**: agents follow these. A stale workflow produces grid-era code.
- **Owner session**: R9

### CR3-019 — Round 2's 74 open tickets never re-checked against the free mat
- **Category / Severity / Effort**: DOC · P2 · M
- **Where**: `archive/docs/code_review_v2_findings.md` §"WHERE THE BACKLOG ACTUALLY STANDS"
- **Owner session**: P1
- **Status**: ✅ **Fixed 2026-09-28 (P1).** 88 tickets walked (the count had grown from 74 once partly-fixed rows were included); see the P1 re-triage section below.

### CR3-020 — No performance tooling exists
- **Category / Severity / Effort**: TST · P1 · L
- **Impact / Confidence / Score**: 5 · 1.0 · 1.25
- **Where**: `package.json` scripts; only instrument is dev-only `FPSCounter.jsx`; `EventBatch` deleted
- **What**: nothing can prove or disprove a 165 FPS claim today. **P1 because the owner's stated top priority cannot be verified without it** — confidence 1.0, it's a plain fact.
- **Owner session**: P2, P3

### CR3-021 — `PERFORMANCE.md` describes the card era
- **Category / Severity / Effort**: DOC · P2 · S
- **Where**: `.agent/guides/PERFORMANCE.md` — names `cards_updated`, `GICard`, `DndProvider`
- **What**: principles are right, specifics stale; rewrite with the mat-era rules R5–R7 establish (targeted events, transform-only motion, one frame clock, no always-on loops).
- **Owner session**: R6 (drafts) · R7 (drag section)

### CR3-022 — Every hero listens to every combat attack
- **Category / Severity / Effort**: RC · P3 · S
- **Impact / Confidence / Score**: 2 · 0.6 · 1.2
- **Where**: `src/ui/components/board/MatHero.jsx:28-38` (`useLastAttackAt` subscribes to `COMBAT_ATTACK_EVENT` and filters by `heroId`)
- **What**: 8 heroes × every attack. Cheap today; the `tokenEvents.js` id-router pattern already exists and could serve heroes too.
- **Owner session**: R4

---

## P1 — Round-2 re-triage *(2026-09-28, against `main` at `17fdcef`)*

Every CR2 ticket that round 2's tracker did not mark fixed or moot — **88
tickets** (90 rows; CR2-062 and CR2-168 each appear twice) — was checked against
the current code, not against its own status line. Each verdict below cites what
was looked at. Round 2's two documents are archived to `archive/docs/`; **this
table is now the only record of what happened to them.**

### Closed — 37

| CR2 | Verdict | Evidence |
|---|---|---|
| 011 | ✅ Fixed (content) | `item_blackberry` now exists in `items.json`; `token_thorn_elemental` drops it |
| 014 | ✅ Fixed | enemies folded into Tokens; no `biomeId` in content; only a comment in `StateSchema.js` |
| 029, 074 | ⚪ Moot | the gear-stat pipeline was deleted (UE-16, `EquipmentManager.js:180-195`); items are effect bearers |
| 046 | ✅ Fixed | `card_spawned`, `cards_updated`, `game_saved`, loop-start events gone; EventBus logging kept on purpose |
| 050 | ⚪ Moot | loot sprites take mat points (`SpriteLayer.js:170-175`) since slice 1.8 |
| 052, 063 | ⚪ Moot | `Cartographer.js` deleted (Map bursts retired, `ac88c99`); map quests retired (TL 9.5) |
| 056 | ✅ Fixed | `collectSprite` now 2 publishes; sweeps batched (`asSweep`). Load re-measured in R4 |
| 062 | ⚪ Moot | `getOccupyingToken` gone with the grid |
| 082 | ✅ Fixed | `XP_TABLE` is read (`XPCurve.js:94`) |
| 084 | ✅ Fixed | `RANDOM_HUNTS` targets `token_goblin` (TL 9.5) |
| 092 | ✅ Fixed | all ten dead events have zero publishers now |
| 095 | ⚪ Moot | `QuestManager` uses `Date.now()` only for ids; the Time Bank is out of scope (owner) |
| 109, 112, 114, 123 | ⚪ Closed | already marked STALE by the 2026-08-26 triage; re-confirmed nothing live remains |
| 111 | ✅ Fixed | `data/tokenRecipes.json` now holds authored recipes |
| 115 | ✅ Fixed | `recipes.json`, `encounters.json`, `subskills.json` deleted; `DatabaseManager` no longer globs them |
| 121 | ✅ Fixed | 0 of 94 Tokens carry top-level `charges`/`xp` |
| 124 | ✅ Fixed | `public/assets/ui/pm_table_*.png` exist at the manifest path |
| 132 | ✅ Fixed | all three events `useUIModals` subscribes to now have a publisher |
| **139** | ⚪ **False premise** | claimed `options.deps` falling back to a fresh `[]` re-runs the effect every render. React compares deps **element by element**, not by array identity — an empty array never re-triggers. Nothing to fix. |
| 148, 149 | ✅ Fixed | both dead particle branches removed (`ParticleOverlay.jsx:84-93` records it) |
| 151 | ⚪ Moot | `GISurface.jsx` deleted |
| 157, 176 | ⚪ Moot | `RightmostHeroDock`/`VerticalHeroDock` deleted; recall now via `dockRecall.js` |
| 162 | ⚪ Moot | gold retired (SP-65, `4e97816`) |
| 167 | ⚪ Moot | the upgrade board was rebuilt as a web (B9, `9e45e7e`); R8 re-checks the new surface fresh |
| 168 | ⚪ Void | grid-era render notes measured on the 7×7; superseded by CR3-007…012 and re-measured in R6 |
| 170 | ⚪ Moot | its remaining part was the Map branch; Map bursts retired |
| 181 | ⚪ Moot | `TokenBank.js`/`TokenVaultTab.jsx` deleted (Vault retired, `6e86e5e`) |
| 191 | ✅ Fixed | zero `no-undef` in game source (lint, this session) |
| 195 | ✅ Fixed | no bare `token_exhausted` subscription remains (it is only a payload `type`) |
| 198 | ✅ Fixed (content) | `item_copper_ingot` now appears in 3 recipes — **confirm in play during session C** |

### Routed elsewhere — 7

| CR2 | Where it lives now |
|---|---|
| 003, 032, 189 (**P0**), 190 | **CMS lane** — owner routed 2026-08-26; round 3 does not review `cms/src` |
| 201 | **Economic-simulator lane** — handoff item |
| 098 | **Closed by owner decision 32** ("keep collecting") — no action |
| 150 | Informational ("not a bug — recorded so nobody files it") — closed |

### Carried into round 3 — 44 tickets, grouped

| CR3 | Absorbs CR2 |
|---|---|
| CR3-018 | 009 |
| CR3-020 | 067 |
| CR3-024 | 174, 083 (part) |
| CR3-025 | 036, 083 (part), 152, 171, 184 |
| CR3-026 | 186, 188 |
| CR3-028 | 058 |
| CR3-029 | 057 |
| CR3-030 | 105 |
| CR3-031 | 026 |
| CR3-032 | 027, 028, 061 |
| CR3-033 | 131, 047 |
| CR3-034 | 094 |
| CR3-035 | 087 |
| CR3-036 | 020, 075, 076 |
| CR3-037 | 106 |
| CR3-038 | 024, 025, 039, 091 |
| CR3-039 | 031 |
| CR3-040 | 185, 194 |
| CR3-041 | 004, 005, 182, 199 |
| CR3-042 | 010 |
| CR3-043 | 142, 147, 161 |
| CR3-044 | 101 |
| CR3-045 | 200 |
| CR3-046 | 045, 187 |

---

### Filed by P1 — 2026-09-28

### CR3-023 — Three dangerous import cycles have appeared since round 2
- **Category / Severity / Effort**: LAY · P2 · M
- **Impact / Confidence / Score**: 3 · 1.0 (tool output) · 1.5
- **Risk**: medium — a static cycle can hand a module an undefined import at load, depending on import order
- **Where**: `npm run cycles` — (1) `BoardCombat.js ↔ Flags.js`, a 6-module group; (2) `SpawnerSystem.js ↔ TimedChanges.js`; (3) `QuestManager.js ↔ QuestTokens.js`. The 16-module `GameState` group is broken by a dynamic import, as in round 2.
- **What**: round 2 closed with **zero** all-static cycles. All three are new, from Hero Movement and Token Lifecycle.
- **Owner session**: R2 (group 1), R3 (group 2), R4 (group 3)

### CR3-024 — Two dead dock components (absorbs CR2-174, part of CR2-083)
- **Category / Severity / Effort**: DC · P3 · S
- **Where**: `src/ui/components/dock/HeroDockCard.jsx` (imported by nothing — checked `src/`, `cms/src/`, `src/tests/`), `DockSkillsGrid.jsx` (imported only by `HeroDockCard`). CR2-174's item 1 (`h-[DOCK_TAB_H]`) lives in the dead file; its items 2–4 are gone.
- **Owner session**: R9

### CR3-025 — Lint residue, regenerated (absorbs CR2-036, 152, 171, 184, part of 083)
- **Category / Severity / Effort**: DC+WIRE · P3 · M
- **Where**: `npm run lint` at `17fdcef`: 70 `no-unused-vars`, 8 `react-hooks/exhaustive-deps`, 3 `no-useless-assignment`, and **25 `no-undef` all in test files** because `eslint.config.js` gives tests no Node globals (`__dirname`, `process`, `require`) — CR2-184's config gap.
- **What**: round 2's site lists were stale in both directions; **use this regenerated list only.** Each "assigned but never used" is a candidate half-wired feature. Distribute by territory at the start of each R-session.
- **Owner session**: every R-session for its own paths; R9 for the config gap

### CR3-026 — The bundle grew a third, still one chunk (absorbs CR2-186, 188)
- **Category / Severity / Effort**: PNT · P3 · M
- **Where**: `npm run build`: **1,152 KB JS** (352 KB gzip), up from 865 KB; single chunk; 3 "dynamic import will not move module" warnings (`GameState.js` lazy imports, `SettingsModal.jsx`); five `@fontsource/*` in `dependencies`.
- **What**: startup parse cost on a desktop app is modest, but the growth is worth one look — e.g. `framer-motion`'s share. Measure first.
- **Owner session**: R9

### CR3-027 — The 38.6 MB art folder is not in version control
- **Category / Severity / Effort**: DOC · P2 · S *(a question for the owner, not a code fix)*
- **Impact / Confidence / Score**: 4 · 1.0 · 4.0
- **Where**: `.gitignore:40` ignores `public/assets/` — 1,102 files, 38.6 MB (was 11 MB at round 2).
- **What**: the game's art has **no git history and no rollback point**; a tag like `v0.8.0` cannot reproduce the game on another machine. It also means a fresh checkout cannot run the art tests (26 test files fail in a clean worktree). There may be a deliberate reason (size, a separate art pipeline) — **owner to decide**: keep ignored, use Git LFS, or back up elsewhere.
- **Owner session**: owner question, raised at the end of P1
- **Owner ruling 2026-09-28: put the art under Git LFS.** A repository change, not review work — done as its own small slice outside the review sessions (queued as a separate task). ⚠ Nothing has been pushed to GitHub by the owner's standing instruction; check LFS storage limits before the first push. `public/assets/` also holds folders named `archive` and `maybe` — ask whether those belong in version control before tracking everything.
- **Status**: ✅ **Fixed 2026-09-28** (`e928368`). 1,048 files tracked through Git LFS (`.gitattributes`: `public/assets/**`). Left out, pending an owner answer (run log question 1): `archive/`, `maybe/` and the two `waste/` folders — 54 files, none referenced by code; one `waste` zip also exceeds Windows' path limit. Verified: a fresh worktree gets all 1,048 files, byte-identical; test baseline unchanged (10 known failures). **Clean worktrees are now faithful for art** — `cms/node_modules/` is still ignored, so CMS-importing tests still need the real checkout.

### CR3-028 — Input-cost discount applied when paying, not when checking (CR2-058)
- **Category / Severity / Effort**: WIRE · P2 · S
- **Where**: discount applied at completion via `TileModifiers.resolveAxis(INPUT_COST)` (`BoardRunner.js:253-259`); the gate (`WorkCheck.js`, `InputAllocator.checkInputs :60`) never reads `INPUT_COST`.
- **What**: a Token whose neighbours' discount makes a cycle affordable can still show "out of inputs" and never start. Re-verified in code 2026-09-28; not yet reproduced in play.
- **Owner session**: R3

### CR3-029 — Item-threshold triggers re-evaluated on every Bank change (CR2-057)
- **Category / Severity / Effort**: HPB · P2 · S
- **Where**: `TriggerSystem.js:580-586` — "evaluated against the Bank each time the coarse `inventory_updated` fires"
- **What**: same shape as CR3-002 — per-tick work at steady state with 8 heroes producing. The bench will size it.
- **Owner session**: R3

### CR3-030 — The logger always runs at debug level (CR2-105)
- **Category / Severity / Effort**: HPB · P2 · S
- **Where**: `src/utils/Logger.js:31` (`minLevel = debug`)
- **What**: every `logger.debug` on a hot path formats and prints in the shipped game. `PERFORMANCE.md` itself lists console logging as a hot-path pitfall. Bench: count log calls per tick.
- **Owner session**: R1

### CR3-031 — Every tick handler registers at the default priority (CR2-026)
- **Category / Severity / Effort**: CON · P3 · S
- **Where**: `EngineBootstrap.js:195-244` — 9 handlers, no priority argument; order is registration order by accident
- **Owner session**: R1

### CR3-032 — Small per-tick allocations and event bursts in combat, statuses and upkeep (CR2-027, 028, 061)
- **Category / Severity / Effort**: GC · P3 · S
- **Where**: `CombatProcessor.js:79-97` (`heroStatsForUi` rebuilt every combat tick); `StatusEffectSystem.js:118` (`heroes_updated` per hero per status tick — every hero-listening component re-selects); `BlockUpkeep.js:21` (a `filter` per Token per tick)
- **Owner session**: R4 (combat, statuses), R3 (upkeep)

### CR3-033 — About 13 Settings controls change nothing (CR2-131, CR2-047)
- **Category / Severity / Effort**: UX · **P1** · M
- **Where**: `src/ui/modals/SettingsModal.jsx`. Keys with no reader outside Settings (string search, 2026-09-28 — confirm nested reads before acting): `gameplay.enableAnimations`, `gameplay.themeMode`, `showLevelUpMessages`, `showLootMessages`, `showSystemMessages`, `ui.instantPackReveal`, `ui.largeTrayTokens` (the Tray is gone), `ui.tooltipsBoostTiles`, `ui.tooltipsCardBadges`, `ui.tooltipsEnabled`, `ui.tooltipsItems`, `ui.zoomToCursor`; plus `notifications.position`, ignored in column mode (`ToastContainer.jsx:22`).
- **What**: **the owner already decided (CR2-131): disable them and mark "coming soon"** — not implemented. Several now name retired concepts (packs, Tray, tiles, cards) and should simply go.
- **Owner session**: R8

### CR3-034 — Three tutorial steps advance only because React publishes the event (CR2-094)
- **Category / Severity / Effort**: LAY · P2 · S
- **Where**: `useUIModals.js:34-36` is the only publisher of `ui_modal:opened`; `QuestManager.js:250-256` subscribes. Now documented as a contract, but still a rule whose only trigger is in the UI layer.
- **Owner session**: R5

### CR3-035 — Enemy kill counts are never recorded (CR2-087)
- **Category / Severity / Effort**: WIRE · P3 · S
- **Where**: `RegistryManager.recordEnemyDefeat` (`:82`) has no caller
- **What**: downgraded from P1 — the Codex screen it blocked **does not exist** in the current UI; nothing displays kill counts. Wire it or delete it when a Codex is planned.
- **Owner session**: R4

### CR3-036 — Dead combat and loot code (CR2-020, 075, 076)
- **Category / Severity / Effort**: DC · P3 · S
- **Where**: `LootSystem.handleTaskReward` (`:91`) has no caller (`EffectAxes.js:12` says so); the fight object's `combat.stats` is created empty (`CombatProcessor.js:30`) and read (`:93`) but never written. CR2-076's player-facing half (the Cookout yield buff) is **fixed** — YIELD is now applied in `BoardRunner.js:353`.
- **Owner session**: R4

### CR3-037 — A second hero-creation route (CR2-106)
- **Category / Severity / Effort**: CON · P3 · S
- **Where**: `GuildUpgradeManager.js:135-141` calls `generateHero()` directly when the roster upgrade is bought, rather than the hero manager's recruit route
- **Owner session**: R4

### CR3-038 — Retired-concept residue in boot, clock and schema (CR2-024, 025, 039, 091)
- **Category / Severity / Effort**: VES · P3 · S
- **Where**: `TimeManager.js:21` keeps its own clock that restarts at zero each boot; `EngineBootstrap.js:277-279` writes `GameState.exploration` (exploration retired); `StateSchema.js:204-215` `unlockedAreaSets` saved and read by nothing; `tokenConstants.js` `TOKEN_TYPES` enforcement still open (prose fixed)
- **Owner session**: R1 (clock, boot), R9 (schema, constants)

### CR3-039 — Toasts may leave page elements behind (CR2-031)
- **Category / Severity / Effort**: ML · P3 · S
- **Where**: `ToastContainer.jsx:120-145` (the file's own `CR-050` note)
- **What**: a slow DOM leak over a long session. The Tier C soak (DOM node count) will confirm or close it.
- **Owner session**: R8, confirmed in C

### CR3-040 — Most of the engine object is unread by the game — but agents depend on it (CR2-185, 194)
- **Category / Severity / Effort**: DC · P3 · S
- **Where**: `EngineBootstrap.js:114` returns 34 entries; roughly 16 are read by nothing in `src/` (string search). But `main.jsx:67` exposes it as `window.Game`, which **every browser verification on this project uses** (`window.Game.LoopRunner.tick`, …) and which the P3 Perf HUD will use too.
- **What**: do **not** prune without keeping a dev-only probe. Likely resolution: leave it and document it as the debug surface.
- **Owner session**: R1

### CR3-041 — The test harness proves some features only with fixtures (CR2-004, 005, 182, 199)
- **Category / Severity / Effort**: TST · P2 · M
- **Where**: fixtures register **7 of 15** item ids that are not in real content (`src/tests/fixtures/testTokens.js`, `fixtureItems.js`); 17 `ContentRules` cases skipped; several rework features (`ContextToolTiers`…) are proven only against fixtures
- **What**: the suite can be green where the real content is broken — round 2's central lesson. R10 turns this into the coverage plan that must exist before risky fix waves.
- **Owner session**: R10

### CR3-042 — The CMS imports game source across the project boundary (CR2-010)
- **Category / Severity / Effort**: LAY · P2 · M
- **Where**: 30 distinct import specifiers from `cms/src` into the game's `src/`
- **What**: this is why the reachability tool reports `statementSlots.js` and `tempoBands.js` as dead when they are live. Round 3 does not review `cms/src`, but it owns the boundary.
- **Owner session**: R9

### CR3-043 — Small UI leftovers (CR2-142, 147, 161)
- **Category / Severity / Effort**: UX/DC · P3 · S
- **Where**: `useUIModals.js:198-215` defers every nav open by a frame; `LayoutSandbox.jsx` tunes a card that no longer exists (a kept dev surface — round 2 Q5); `BankTab.jsx:34` `typeFilter` state that nothing sets (owner decided: retire)
- **Owner session**: R8

### CR3-044 — Randomness is unseeded everywhere (CR2-101)
- **Category / Severity / Effort**: TST · P3 · S → **matters to P2**
- **Where**: `src/utils/RNG.js` has 1 importer; 63 direct `Math.random()` calls in game source
- **What**: harmless for play, but **a benchmark must be repeatable**: two runs of scenario S2 should do the same work. P2 has to stub `Math.random` with a seeded generator at the bench boundary (without changing game code).
- **Owner session**: P2 (workaround), R10 (verdict)

### CR3-045 — A crafted Token can arrive with unlimited charges (CR2-200)
- **Category / Severity / Effort**: CON · P2 · M
- **Where**: the Token-output drop path; `tokenStartingUses` (`tokenRegistry.js:172`)
- **What**: **needs an owner decision** (as filed in round 2). Token Lifecycle changed how crafted Tokens land (9.3); R3 re-checks whether the gap survives before asking.
- **Owner session**: R3

### CR3-046 — Desktop-shell group, deferred until the Tauri work (CR2-045, 187)
- **Category / Severity / Effort**: CON · P2 · M
- **Where**: `SaveManager.js:168-178` (`exportSave`/`importSave` — no player-facing way to back up a save; owner decision 25: wait for Tauri); `src-tauri/` gaps from CR2-187 (item 2 proposed, not applied)
- **Owner session**: not this round — **deferred by owner decision**; listed so it is not lost

---

## Wave 1 results — P2, R8, R9 *(2026-09-28, merged by the director)*

**How session tickets are kept (director change to plan §10):** each review
session's tickets stay in its own file under `docs/review_v3/`, in full. This
doc holds an **index** of them, plus the director's verdicts on pre-filed
tickets, so there is exactly one copy of every ticket body.

### Verdicts on pre-filed tickets

| Ticket | Verdict | Evidence (session) |
|---|---|---|
| CR3-001 | ✅ **Confirmed by measurement** → severity **P1** (misses a §4.4 target) | `tokens()` called 47×/tick ≈ 59 % of the S2 tick; 131×/tick ≈ 65 % of S3 (P2) |
| CR3-002 | ⚪ **Not supported** — close | `Flags.evaluate` 0.19 calls/tick, 0.01 ms (P2) |
| CR3-003 | ✅ **Confirmed** → **P1** | push solver 3.7 / 17.9 / 40 ms at 40 / 150 / 300 Tokens; S4 worst arrival 59 ms, shrink 20→6 338 ms vs 8 ms target (P2) |
| CR3-004 | ✅ **Confirmed** → **P1**, and **wider**: `rebuildAll` is quadratic **even without an aura** (0.95 / 12.7 / 53 ms at 40/150/300) | S5 p99 14.3 ms vs S2 3.2 ms (P2) |
| CR3-005 | ✅ Confirmed, not dominant — stays P2 | 1.0 `tile_event_alert` per tick per stalled station; 2nd most frequent event after `board:progress` 3.3/tick (P2) |
| CR3-015 | 🔄 Changed | 34 files, not 20; the only save-compat piece is `RETIRED_BOARD_FIELDS` in `SaveMigration.js` (R9) |
| CR3-016 | ✅ Confirmed; rename brief is CR3-501. ⚠ `HeroDockTab.jsx:97` subscribes with the raw string `'board:tile_changed'` — fix it first or the dock silently stops updating (R9) |
| CR3-018 | ✅ Confirmed and widened — see CR3-513/514 (R9) |
| CR3-020 | 🟡 Partly fixed — Tier A built and merged (`42181be`); Tier B is P3 |
| CR3-024 | ✅ Confirmed (R9) |
| CR3-025 | ✅ Confirmed; exact `eslint.config.js` fix written in R9 §7; lint distribution by territory in R9 §7 |
| CR3-026 | ✅ Confirmed, stays P3. Correction: the `@fontsource/*` packages add nothing to the bundle (R9) |
| CR3-029 | ⚪ **Not supported** — close | 0.002 ms/tick (P2) |
| CR3-033 | 🔄 Changed: exactly 13 inert controls; 4 name retired things; 9 need a fresh ruling (run log Q2·Q1) (R8) |
| CR3-038 | 🔄 Changed: 8 retired `collection` fields can leave the schema; `TOKEN_TYPES` must keep `manager` and `map` (R9) |
| CR3-039 | ✅ Confirmed open; lines drifted to `ToastContainer.jsx:134-156`; soak in session C decides (R8) |
| CR3-042 | ✅ Confirmed: 27 game modules imported directly by the CMS, 36 transitively (R9 §5.5) |
| CR3-043 | 🔄 Changed and wider: the only publisher of `ui:open_drawer` is unreachable, so the whole slot-filter chain is dead (R8) |

**Plan corrections found by R9:** plan §2.D is stale — the Guild Hall upgrade
board has not been a 7×7 since B9 (`FreeMatGuards.test.js:202-206` now scans it).
The reachability tool's "barrel hides orphans" explanation for `nameRegistry` is
wrong: the barrel no longer exists; the real cause is a comment apostrophe that
fools the import regex (CR3-505).

### Filed by the director from P2's numbers

### CR3-047 — Spawners at their cap retry every tick; the realistic tick's biggest stage
- **Category / Severity / Effort**: HPB · **P1** · S–M
- **Impact / Confidence / Score**: 5 · 1.0 (measured) · 2.5–5
- **Risk**: medium — spawn timing is gameplay; the fix must spawn at exactly the same moments
- **Where**: `SpawnerSystem.attemptSpawn` re-run every tick for spawners already at their family cap; `syncAlerts` rescans every spawner every tick; both inside `TimedChanges.tick`
- **Evidence**: `TimedChanges.tick` is **0.80 of 1.45 ms** of the S2 tick (P2 profile). With CR3-001 this explains nearly all of the S2 miss.
- **Owner session**: R3

### Performance baseline — Tier A, quiet machine *(`bench/baseline.json`, 2026-09-28, commit `3472ab6`, i7-8700, Node 24.11)*

| Scenario | Tokens | Tick p50 | Tick p99 | Tick max | Events/tick | Heap drift | vs §4.4 target |
|---|---|---|---|---|---|---|---|
| S1 Quiet Hall | 9 | 0.038 ms | 0.172 ms | 1.5 ms | — | — | ✅ |
| S2 Realistic | 109 | 1.33 ms | **3.18 ms** | 14.6 ms | 6.1 | — | ❌ p99 ≤ 1.5, max ≤ 4 |
| S3 Torture | 313 | 5.93 ms | **67.7 ms** | 244 ms | 9.6 | — | ❌ p99 ≤ 4 — a cliff |
| S4 Push storm | 85 | worst arrival **59.6 ms**; shrink 20→6 **338 ms** | | | | | ❌ ≤ 8 ms |
| S5 Rebuild storm | 109 | 1.27 ms | **14.3 ms** | 25.3 ms | 6.3 | — | ❌ |
| S6 Long idle (32 game-min default; 8 h with `--long`) | 109 | 1.30 ms | 3.08 ms | 17.4 ms | — | +0.8 MB over 30 min; P2's 8 h run: +0.3 % h1→h8 | ✅ memory flat |

Re-run with `--compare` on the same machine: every number within 5 %
(`✓ No regression`). Frame-time columns come from P3/C.

⚠ S4 reports **"player drops 0/50 landed"** — R2 must confirm whether the
scenario's crowded region refuses drops by design or the scenario is wrong.

### Index of tickets filed by R8 and R9 (34)

| Ticket | Sev | Effort | Category | Title | File |
|---|---|---|---|---|---|
| CR3-450 | P1 | S | UX+WIRE | The hero sheet beside the Bank closes on the first click inside it | `docs/review_v3/R8.md` |
| CR3-451 | P2 | S | WIRE | The Guild Hall upgrade panel's Close button does nothing visible | `docs/review_v3/R8.md` |
| CR3-452 | P2 | S | WIRE+UX | Toast types look alike, and the "×N" of grouped toasts is never shown | `docs/review_v3/R8.md` |
| CR3-453 | P2 | S | UX | The Typography Scale window is (probably) boxed inside Settings, and Escape leaves an unsaved preview applied | `docs/review_v3/R8.md` |
| CR3-454 | P2 | M | UX | Every surface has its own way to close | `docs/review_v3/R8.md` |
| CR3-455 | P2 | M | UX | Five tooltip implementations, and the shared look is copy-pasted | `docs/review_v3/R8.md` |
| CR3-456 | P2 | M | UX+LAY | z-index: one table for the mat, about 20 hand-typed numbers for everything else | `docs/review_v3/R8.md` |
| CR3-457 | P2 | S | WIRE | Dragging a hero to reorder in the Bank's hero panel shows a drop line, then does nothing | `docs/review_v3/R8.md` |
| CR3-458 | P2 (until measured) | S | RC | Tutorial beacons re-render every frame while shown | `docs/review_v3/R8.md` |
| CR3-459 | P3 | S | DOC+DC | The nav's "rise above my own modal" layer can never work; its comment says it does | `docs/review_v3/R8.md` |
| CR3-460 | P3 | M | DOC+UX | Typography: the code's sizes and fonts are not what renders; the scale is written four times | `docs/review_v3/R8.md` |
| CR3-461 | P3 | S | WIRE+DC | Events subscribed with no publisher, and a publisher nobody can reach | `docs/review_v3/R8.md` |
| CR3-462 | P3 | S | DC | `useUIModals` hands out controls nobody uses (overlaps R5) | `docs/review_v3/R8.md` |
| CR3-463 | P3 | S | WIRE+DC | Props accepted and ignored; branches no caller reaches | `docs/review_v3/R8.md` |
| CR3-464 | P3 | S | VES+DOC | Retired vocabulary on screen, and stale or rambling comments | `docs/review_v3/R8.md` |
| CR3-465 | P3 | S | DC | Stylesheets that are loaded but unused, or used but never loaded | `docs/review_v3/R8.md` |
| CR3-466 | P3 | S | ML | The equip-flash timer's cleanup is returned from an event handler, so it never runs | `docs/review_v3/R8.md` |
| CR3-467 | P3 | M | DC | Lint residue in R8's territory (claimed from CR3-025) | `docs/review_v3/R8.md` |
| CR3-500 | P3 | S | VES+UX | Players read "tile" in rules text, and the editor's reach hint is wrong | `docs/review_v3/R9.md` |
| CR3-501 | P3 | M | VES | Rename the tile-named engine vocabulary (the CR3-016 execution brief) | `docs/review_v3/R9.md` |
| CR3-502 | P3 | S | DC | Dead tile- and Tray-era code with no reader | `docs/review_v3/R9.md` |
| CR3-503 | P3 | M | VES+DOC | Tray names and Tray-as-current comments in live code | `docs/review_v3/R9.md` |
| CR3-504 | P3 | S | VES | Card/deck-era names in live code | `docs/review_v3/R9.md` |
| CR3-505 | P2 | S | TST | The reachability and cycle tools miss an import after a comment with an apostrophe | `docs/review_v3/R9.md` |
| CR3-506 | P3 | S | TST | `.mjs`/`.cjs` files are linted with no rules; `bench/` is not covered | `docs/review_v3/R9.md` |
| CR3-507 | P3 | S | DC | Five `@fontsource/*` packages are declared but never imported | `docs/review_v3/R9.md` |
| CR3-508 | P3 | S | CON | The build ships and pre-loads un-versioned art, and two test pages | `docs/review_v3/R9.md` |
| CR3-509 | P3 | S | CON | Build warnings: two dynamic imports are load-bearing, one is pointless | `docs/review_v3/R9.md` |
| CR3-510 | P2 | S | LAY | The "content grammar" modules must stay pure for the CMS, and nothing says so | `docs/review_v3/R9.md` |
| CR3-511 | P3 | S | LAY | The CMS imports `itemRegistry` for one constant and drags the content loader with it | `docs/review_v3/R9.md` |
| CR3-512 | P3 | M | LAY | Two ways into the engine: `useEngine` and direct module imports | `docs/review_v3/R9.md` |
| CR3-513 | P2 | M | DOC | The documents agents load first are wrong, and one tells them to hand-edit content | `docs/review_v3/R9.md` |
| CR3-514 | P3 | S | DOC | Archive sweep: ~45 history docs in live folders, and two archive folders | `docs/review_v3/R9.md` |
| CR3-515 | P3 | M | LAY | Starting content and quest content are written in engine code | `docs/review_v3/R9.md` |
