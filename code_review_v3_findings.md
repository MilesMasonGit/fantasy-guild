# Fantasy Guild — Code Review **Round 3** Findings

The tracker for [`code_review_v3_master_plan.md`](code_review_v3_master_plan.md).
Tickets are **`CR3-NNN`**. Read the plan's §6 for severity, category codes and
the priority score.

> **Plan approved — all six §9 questions answered (2026-09-27/28).** The
> tickets below were filed during planning (2026-09-27) from **reading the code,
> not measuring it**. Every one says so. P2's benchmark confirms or closes them.

---

## Session Status *(update at the end of every session)*

| # | Session | State | Date | Commit | Notes |
|---|---|---|---|---|---|
| — | Planning survey | ✅ Done | 2026-09-27 | *(uncommitted — plan Q6)* | 22 tickets pre-filed |
| P1 | Clean baseline & round-2 re-triage | 🔲 Not started | | | |
| P2 | Build Tier A — headless benchmark | 🔲 Not started | | | |
| P3 | Build Tier B — stress scenarios + Perf HUD | 🔲 Not started | | | |
| R1 | Engine loop, clock & event bus | 🔲 Not started | | | |
| R2 | Board state & spatial physics | 🔲 Not started | | | |
| R3 | Work, flags & rule evaluation | 🔲 Not started | | | |
| R4 | Combat, heroes, effects & loot | 🔲 Not started | | | |
| R5 | UI ↔ engine boundary & render cascades | 🔲 Not started | | | |
| R6 | Mat renderer: paint, layout & composite | 🔲 Not started | | | |
| R7 | Drag & drop and input | 🔲 Not started | | | |
| R8 | UI/UX consistency across surfaces | 🔲 Not started | | | |
| R9 | Vestiges, documentation & layer separation | 🔲 Not started | | | |
| R10 | Expansion readiness & test coverage | 🔲 Not started | | | |
| C | Runtime certification (hands-on) | 🔲 Not started | | | |
| Z | Synthesis & fix waves | 🔲 Not started | | | |

---

## Baselines

### Planning snapshot *(indicative only — dirty tree)*

Branch `b9/hall-web`, HEAD `00c8550`, with another session's uncommitted work
in 7 files. `vitest run`: **3,691 passed / 15 failed / 29 skipped, 226 files.**

### Clean baseline *(P1 fills this in on clean `main`)*

| Measure | Value |
|---|---|
| Commit | |
| Tests | |
| `npm run lint` problems | |
| `npm run cycles` | |
| `npm run duplication` | |
| `node tools/reachability.mjs` non-test orphans | |
| `npm run build` JS / CSS / `public/assets` | |

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
- **Where**: `code_review_v2_findings.md` §"WHERE THE BACKLOG ACTUALLY STANDS"
- **Owner session**: P1

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
