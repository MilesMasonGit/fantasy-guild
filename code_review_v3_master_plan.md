# Fantasy Guild — Code Review **Round 3** Master Plan

> **✅ APPROVED.** Written 2026-09-27; **all six §9 questions answered by the
> owner** (Q1–Q4 on 2026-09-27, Q5–Q6 on 2026-09-28): drawing-only 165 target,
> the owner's PC measured by frame budget, §4.4 targets and scenario sizes
> approved as written, throwaway spikes allowed, round 2's open tickets
> re-triaged in P1, plan committed on its own branch. Sections marked
> **[JUDGEMENT CALL]** are choices this plan made on its own and can be argued
> with.

**Companion file:** [`code_review_v3_findings.md`](code_review_v3_findings.md) —
the findings tracker every session writes into. Tickets this round are
**`CR3-NNN`**. **22 tickets are pre-filed** from the planning survey
(CR3-001…022). Every one is marked **reasoned, not measured** — the benchmark
tooling in §4 is what turns them into measured facts or closes them.

**Round 2** (archived 2026-09-28 to `archive/docs/code_review_v2_guide.md` and `archive/docs/code_review_v2_findings.md`) is
**history, not current truth.** Its method is inherited (§6). Its open tickets
were re-triaged by Session **P1** on 2026-09-28 — see the findings doc.

---

## 0. The short version, in plain language

The game swapped a fixed grid for a free playmat. That changed the maths under
almost everything: on a grid there were at most 36–49 squares and "who is next
to whom" was a lookup; on the mat there can be 150+ Tokens and "who is near
whom" is a measurement the engine re-does, often by walking the whole list.

The survey found **no sign the game is slow today** — nobody has measured it
since the grid went. What it found is a set of habits that are cheap at 40
Tokens and expensive at 200, plus a few things that cost screen-time every
single frame no matter what (moving heroes by a property that forces the browser
to re-lay-out the page; a full-screen particle canvas that redraws 165 times a
second even when empty).

So the plan is: **build the measuring tools first, measure, then review with
numbers in hand.** No one should "optimise" on a hunch.

**The biggest thing to understand about "165 FPS"** (§2.A): the game's *rules*
only run 10 times a second. What must happen 165 times a second is the
*drawing*. Those are two different budgets and the review treats them
separately.

---

## 1. Why round 3 exists — what changed since round 2

| | Round 2 close (2026-08-19) | Now (2026-09-27, `00c8550`) |
|---|---|---|
| Non-test source files in `src/` | 232 | **264** |
| `src/systems/board/` | 16 files, ~4,600 lines | **49 files, 14,682 lines** — tripled |
| `src/ui/components/board/` | 10 files | **46 files, 7,688 lines** |
| Tests | 1,136 passed | **3,691 passed / 15 failed / 29 skipped** in 226 files *(dirty tree — see §6.3)* |
| Board model | 7×7 grid, adjacency lookup | Free mat, distance radii, push/nudge, flags, walking heroes and enemies |
| Mat size | fixed 49 cells | Mat Tuner: 6–20 steps; placed-Token cap default **40**, max **200**; spawned Tokens uncapped by it |

Four reworks landed since round 2 closed: Free Playmat (1.0→1.11, tagged
`v0.8.0`), Hero Movement (M1–M5), Hero Speech Bubbles, and Token Lifecycle
(spawners, foundations, timed changes, enemies on the mat, quests as Tokens, the
discard bin). **None of that code has had a full review.** Round 2's performance
verdict — "the engine runs 30× inside its budget" — was measured on the grid and
**is void**.

Round 2 also left **74 open tickets** (as of 2026-08-27). Many name grid-era
files. Nobody has re-checked them against the free mat.

---

## 2. Challenging the brief — six assumptions worth correcting before we start

The owner asked for assumptions to be challenged. These are the ones that change
how the review should be run.

### 2.A "165 FPS" is a drawing target, not an engine target

- The engine ticks **10 times a second** (`TICK_INTERVAL_MS = 100`,
  `src/config/loopConstants.js:13`) on a `setInterval` (`GameLoop.js:40`).
  That is by design and nothing in the brief needs it faster.
- Heroes and enemies look smooth because the browser **slides** them between
  tick positions with a 100 ms CSS transition (`MatHero.jsx:122`,
  `MatToken.jsx:348`, `HeroBubbleLayer.jsx:200`).
- So the 6.06 ms budget belongs to the **browser frame**: style → layout →
  paint → composite, plus any JavaScript that runs in that frame.
- The engine still matters, indirectly: a tick is one lump of work that lands
  *inside* some frame. **A 4 ms tick steals 4 ms from one frame in every 16** —
  at 165 Hz that is a visible hitch ten times a second. So the engine gets its
  own, tighter budget (§4.4: p99 ≤ 1.5 ms at realistic load), and so does the
  React work a tick triggers.

**Consequence for the plan:** two separate certification tracks — a headless
engine benchmark (fast, automatable, runs in `npm`) and an in-game frame
benchmark (needs a real window on real hardware). See Q1 and Q2.

### 2.B A 165 FPS claim needs a 165 Hz screen — or a budget measurement instead

A browser only draws as often as the monitor refreshes. On a 60 Hz screen an FPS
counter will never read above 60, whatever the code does. **Recommendation:**
certify on **frame-time budget** (how many milliseconds each frame actually
cost), which can be measured on any screen, and confirm on a 165 Hz screen once
at the end. See Q2.

### 2.C Tauri is Chromium on Windows — but not everywhere

On Windows the desktop build runs in **WebView2** (Chromium), so Chrome DevTools
profiles are representative. If Steam Deck / Linux is a target, Tauri uses
**WebKitGTK** there, which is a different and generally slower engine, and the
certification would need repeating on it. See Q2.

### 2.D "No tiles" does not mean "no grids anywhere"

There are **393** uses of the word *tile* in non-test source. Some are genuine
residue (`TileModifiers`, `TILE_CHANGED`, `TILE_EVENT_ALERT`). Others are
**legitimate and must not be touched**:

- **Terrain** is a raster of little squares (`TerrainLattice.js` alone has 122
  hits) — that is how the painted ground is drawn, not a game grid.
- **The Guild Hall upgrade board is still a separate 7×7** by locked decision,
  and its tile indices are not interchangeable with the mat's.
- **Sprite-sheet "tiles"** in `sprite-manifest.js` are art, not board.

A blind "purge tile" pass would break all three. Session **R9** classifies every
hit before anything is filed for deletion.

### 2.E `PERFORMANCE.md` is itself out of date

The house performance guide (`.agent/guides/PERFORMANCE.md`) still names
`cards_updated`, `GICard`, `DndProvider` and a "~10 Hz state_changed" model from
the card era. Its *principles* are right; its *specifics* are stale. It is a
standard to **rewrite** in Session R6/R7, not a checklist to enforce as written (CR3-021).

### 2.F The mat is ~150 separate web-page elements, and that may be the real ceiling

Every Token, hero, flag, badge, ring and bubble is a React-managed page element,
many with drop-shadow filters (~40 filter/blur uses across the UI). At some
number of Tokens the browser's cost of *compositing* those elements will dominate
whatever the JavaScript does. The alternative — drawing the mat into a single
canvas, as the terrain already is (`TerrainCanvas.jsx`) — is a **large
architectural decision**. **This plan does not pre-decide it.** Session R6 is
told to measure where the ceiling actually is and bring the owner a costed
choice *only if* the numbers say the element-based mat cannot reach the target
after the cheap fixes.

---

## 3. Executive codebase survey

Everything below is **reasoned from reading the code, not measured.** Each item
is pre-filed as a CR3 ticket with a hypothesis the benchmarks must confirm or
kill. File:line references were checked against the tree on 2026-09-27.

### 3.1 Engine hot-path risks

| # | What | Where | Why it matters at 150+ Tokens | Ticket |
|---|---|---|---|---|
| H1 | **The list of Tokens is rebuilt from scratch on every call** — copied, filtered and *sorted* each time. Called ~40 places, several times per tick (the board loop, enemy walking, every flag's search, spawner counting, placement, the cap badge…). | `BoardState.js:271-276` | Each call is a sort of the whole mat plus two throwaway arrays. At 10 Hz × many callers this is steady garbage for the collector. The likely fix is a cached ordered list that is only rebuilt when a Token is added, removed or moved. | CR3-001 |
| H2 | **Every flag re-searches the whole mat whenever the Bank changes.** `inventory_updated` marks flags dirty; with 8 heroes working, the Bank changes nearly every tick, so each un-claimed flag scans every Token, sorts candidates and runs the full work check on each. | `Flags.js:1270`, `evaluate` at `:489-562` | Cost grows as heroes × Tokens × work-check. Probably fine at 40 Tokens; unknown at 200. | CR3-002 |
| H3 | **No spatial index.** "What is near this point?" walks every Token (`nearby.js`, `MatPlacement.contextFor :148`, `restockTargetAt :591`). The push solver compares every pair of bodies, **30 passes** (`PUSH_PASSES = 30`, `relax :374-430`). | `nearby.js`, `MatPlacement.js` | Linear per query is fine at 40; the push solver is quadratic × 30 and runs on drops, spawns and mat shrinks. A crowded spawn burst is the worst case. | CR3-003 |
| H4 | **One board-wide aura turns every neighbourhood change into a whole-mat rebuild — and each Token's rebuild walks the whole mat again.** Walking enemies announce a neighbourhood change every time they finish a stroll. | `TileModifiers.js:568-576`, `applicableStatements :341-380`, `EnemyMotion.js:230` | Quadratic rebuilds, triggered continuously by pottering enemies, but only while a board-reach rule is on the mat. Easy to miss in testing. | CR3-004 |
| H5 | **A stalled Token re-announces its problem every tick** — a fresh event with freshly built message strings, 10 times a second, for every Token waiting on inputs, charges or a missing neighbour. (The UI side is already efficient: `tokenEvents.js` routes each alert only to its own Token.) | `BoardRunner.js:640-700` | Steady allocation, and that Token's alert handler re-runs 10×/s for a message that hasn't changed, on a mat where many stalled stations is the normal idle state. | CR3-005 |
| H6 | **The engine clock and the drawing clock are unsynchronised.** The tick runs on `setInterval`, so a heavy tick lands in whatever frame it happens to hit. | `GameLoop.js:40` | Not a bug; a choice the review should make consciously (see R1). | CR3-006 |

### 3.2 Drawing / render-path risks

| # | What | Where | Why it matters | Ticket |
|---|---|---|---|---|
| R1 | **Walking heroes and enemies are moved with `left`/`top`**, which makes the browser re-calculate the page layout every frame of every walk. Moving with `transform` instead is handled by the graphics card and skips layout entirely. | `MatHero.jsx:122`, `MatToken.jsx:343-352`, `HeroBubbleLayer.jsx:196-201` | **Probably the single cheapest large win for 165 Hz.** With 8 heroes and several enemies walking, layout is running almost continuously. | CR3-007 |
| R2 | **The whole mat re-renders 10 times a second while anything walks.** `HEROES_WALKED` / `ENEMIES_WALKED` fire every tick something moves; `MatBoard`'s hero and Token selectors listen to them, rebuild their lists, and the board then re-sorts every Token. Only **1 of 32** board components is wrapped in `React.memo`. | `HeroMotion.js:420`, `EnemyMotion.js:327`, `MatBoard.jsx:84-110, 119-168` | Enemies potter constantly, so this is effectively permanent. | CR3-008 |
| R3 | **`state_changed` fans out to every Token.** It is published from 31 places in the engine; every `MatToken` and four `MatBoard` selectors listen to it. Each firing runs one selector *per Token*, and some selectors do real work — e.g. a spawner's live count walks and sorts the whole mat (`SpawnerSystem.countOf :128-131`), so one event costs roughly Tokens × Tokens. | `MatToken.jsx:167-210`, `MatBoard.jsx`, `SpawnerSystem.js:128` | The classic render cascade. `useGameState` also deep-compares every result. | CR3-009 |
| R4 | **A full-window particle canvas is cleared and redrawn every frame, forever**, even with no particles on screen. The 2026-09-16 handoff already noted the renderer "never idles" because of it. | `ParticleOverlay.jsx:114-123` | 165 full-screen clears a second for nothing. Should sleep when empty. | CR3-010 |
| R5 | **Many independent timers.** Each working Token runs its own animation loop for its progress ring (`TokenBadgeRow.jsx:110-116`); each enemy sprite runs its own interval and React state update per frame (`AnimatedEnemySprite.jsx:81`); plus half-second polls in `FlagLayer`, `FlagRulesPanel`, `TurnRing`, `TrickleTooltip`, `HeroBubbleLayer`, `MatUpkeepBadge`, `UpkeepSummaryPanel`, `TokenInspection`. | listed | Individually tiny; together they fragment every frame. One shared frame clock is the usual cure. | CR3-011 |
| R6 | **Drop-shadow filters on every Token and hero sprite**, with filter transitions. | ~40 uses; `MatToken.jsx:482`, `MatHero.jsx:136`, `SpriteLayerView.jsx:183` | Filters are re-rasterised when they change; at 150 elements the graphics cost may be the ceiling (§2.F). Must be measured before anyone changes art. | CR3-012 |

### 3.3 Layer-boundary observations

- **A UI component publishes an engine-namespaced event** — `MatToken.jsx:247`
  sends `TILE_EVENT_ALERT` when a drag of the Guild Hall misses. It is a message,
  not a rule, so probably fine — but the event registry (`boardEvents.js`) should
  say who is allowed to publish what. (CR3-013)
- **`SpriteLayer.tick` reads the wall clock** (`Date.now()`, `SpriteLayer.js:530`)
  instead of game time. The Time Bank is out of scope by owner instruction, so
  this is filed P3 as a contract note only. (CR3-014)
- The v2 boundary sweeps (subscriptions paired with unsubscribes; no rule in a
  React component) have **not** been re-run over the ~40 new UI files. R5 owns it.

### 3.4 Vestigial systems and stale documentation

- **The Tray is gone as code** (no `Tray.jsx`, no `TrayMiniBoard.jsx`) but the
  word survives in **20 source files**, including `BoardState.js`,
  `StateSchema.js`, `DndKit.jsx`, `Restrictions.js` and `AssetPreloader.js`.
  Some will be save-compatibility, some residue. (CR3-015)
- **Tile-named engine API**: `TileModifiers`, `TILE_CHANGED`, `TILE_EVENT_ALERT`,
  `ADJACENCY_DIRTY`. The handoff (§8.3) says the rename is safe now. It is
  vocabulary, but vocabulary that makes every new agent think in tiles. (CR3-016)
- **`Placement.js` and `MatPlacement.js` both exist.** The code says one is rules
  and one is geometry — plausible, but it needs a verdict. (CR3-017)
- **Stale agent docs**: `.agent/guides/TILESYSTEM.md`,
  `.agent/workflows/add-tile.md`, `add-card.md`, `add-playmat.md`,
  `crafting_cards_documentation.md`, `food_and_drink_technical_documentation.md`,
  `chaos_system_architecture.md`, `.agent/handoff_hero_dock_food_equip.md`, and
  `PERFORMANCE.md` (§2.E). The repo root holds **44** markdown files and `docs/`
  **46** more, of mixed vintage. (CR3-018)
- **Round 2's 74 open tickets have never been re-checked against the free mat.**
  (CR3-019, owned by Session P1)
- **No automated performance tooling exists at all** — no benchmark script, no
  frame telemetry, no render counter. `EventBatch` (round 2's coalescing tool)
  has since been deleted. The only instrument is a dev-only `FPSCounter`.
  (CR3-020)

### 3.5 Verification constraints the tooling must design around

Learned the hard way on this project and recorded in memory and the handoff:

- **Screenshots time out** in the preview pane (the particle canvas keeps the
  renderer busy). All telemetry must be **readable as text/JSON** from a
  `window.` probe.
- **The game loop barely ticks in a hidden or preview pane** — browsers throttle
  background timers. **Frame measurements taken in the agent's preview pane are
  not representative.** Engine numbers come from the headless benchmark;
  frame numbers come from a real, focused window (ideally the Tauri build) on
  the reference machine.
- **In a fresh game no authored Token is workable and the roster is 0** — by
  design. Stress scenarios must **register fixture Tokens at runtime**, never
  edit `data/*.json`.

---

## 4. Benchmarking & telemetry — build this before the review reads a line

**[JUDGEMENT CALL]** Round 2's rule was "review sessions never edit game code".
This plan keeps that rule for review sessions, but adds **two build sessions
(P2, P3) before the review** whose only job is tooling. The tooling is
dev-only, lives outside the shipped game paths, and is merged like any other
feature: on a branch, tested, verified.

### 4.1 Tier A — headless engine benchmark (`npm run bench`)

**What it is:** a Node script that boots the real engine without React or a
browser, builds a scenario, and drives ticks synchronously through
`GameLoop.runHandlers(100)` — the same entry point `DevTools.advanceTime` uses.

**Files (proposed):** `bench/` at the repo root —
`bench/run.mjs` (runner), `bench/scenarios/*.mjs`, `bench/fixtures.mjs`
(runtime-registered Token types, never `data/`), `bench/baseline.json`
(committed reference numbers), `bench/results/` (git-ignored).

**What it records, per scenario:**

| Metric | How |
|---|---|
| Tick time: mean, p50, p95, p99, max | `performance.now()` around each `runHandlers` call; 2,000 warm-up ticks discarded |
| Per-handler breakdown | wrap each entry in `GameLoop.tickHandlers` with a timer (board_runner, sprite_layer, live_effects, …) and, inside `board_runner`, the stages Flags / HeroMotion / EnemyMotion / Hostiles / Token loop |
| Events published per tick, by name | a counting wrapper around `EventBus.publish` |
| Listener calls per tick | same wrapper, summing subscriber counts |
| Allocation pressure | `process.memoryUsage().heapUsed` deltas over 10,000 ticks with `--expose-gc` forced collections between phases; `--cpu-prof` flame file on demand |
| Hot-function counts | `BoardState.tokens()` calls per tick, `TileModifiers.rebuildToken` calls per tick, push-solver pair checks |

**Scenarios:**

| Id | Name | Shape |
|---|---|---|
| S1 | Quiet Hall | Guild Hall, 1 hero, 5 Tokens — the floor |
| S2 | **Realistic late game** | 8 heroes with flags, 40 placed + ~60 spawned Tokens, 6 walking enemies, loot dropping, a quest Token, several stalled stations |
| S3 | Torture | 8 heroes, 200 placed + 100 spawned, 20 enemies, one board-reach aura |
| S4 | Push storm | 50 Tokens dropped into one crowded region; a mat shrink from 20 → 6 |
| S5 | Rebuild storm | S2 plus a board-reach aura, enemies strolling continuously |
| S6 | Long idle | S2 run for 8 hours of game time (288,000 ticks): heap after GC must be flat, every runtime map/array bounded |

**Output:** a table on the console and a JSON file tagged with commit hash,
Node version and machine name. `npm run bench -- --compare` diffs against
`bench/baseline.json` and fails on a regression greater than 20 %.

**Micro-benchmarks** (Vitest `bench`, `npm run bench:micro`): `BoardState.tokens()`,
`nearby.tokensWithin`, `MatPlacement.relax`, `Flags.evaluate`,
`TileModifiers.rebuildAll` — each at 40 / 150 / 300 Tokens so growth curves are
visible, not just single numbers.

⚠ **Never time anything under `jsdom`** (the test environment) — it distorts
costs badly. The bench runs in plain Node.

### 4.2 Tier B — in-game perf harness (dev builds only)

**Stress scenarios in the running game:** the same S1–S5 scenario builders,
reachable from `TestDashboard` and from a URL flag (`?stress=realistic`). Behind
the existing `import.meta.env.DEV || debugMode` gate, like the other dev
surfaces (round 2 owner ruling Q5).

**Perf HUD overlay** (toggle, dev only) showing live:

- **Frame times** from a `requestAnimationFrame` delta ring buffer: p50 / p95 /
  p99, and counts of frames over 6.06 ms, 8.33 ms, 16.7 ms.
- **Long Animation Frames** via `PerformanceObserver` (`long-animation-frame`,
  supported in WebView2/Chromium) — *which script* made a frame long.
- **Engine tick cost** via `performance.mark`/`measure` around `runHandlers`.
- **React commits per second** per surface, via `<React.Profiler>` around
  `MatBoard`, the dock, the drawer and the top bar.
- **Events per second**, **DOM node count**, **EventBus listener total**,
  **JS heap** (`performance.memory`, Chromium only).

**Agent-readable:** everything is also on `window.__perf` with
`window.__perf.report()` returning JSON and `window.__perf.reset()` — because
screenshots don't work here (§3.5). An agent can drive a scenario and read the
numbers with `javascript_tool`.

**Owner-readable:** a "Copy report" button, so the owner can run a scenario on
their own machine and paste the result into a chat.

### 4.3 Tier C — soak test

Run S2 in a real, focused window for **60 minutes** real time. Record at 5, 30
and 60 minutes: heap after a forced GC (DevTools), DOM node count, EventBus
listener total, live timer count. This is the leak detector. Heap snapshots at
5 and 60 minutes are diffed for retained growth.

### 4.4 Certification criteria — what "done" means for Pillar 1

**[JUDGEMENT CALL] — the numbers below are proposals; the owner approves them
in Q3.**

| Area | Scenario | Target |
|---|---|---|
| Engine tick (headless) | S2 Realistic | **p99 ≤ 1.5 ms**, max ≤ 4 ms |
| Engine tick (headless) | S3 Torture | p99 ≤ 4 ms (degrade gracefully; no cliff) |
| Push solver | S4 | any single drop or shrink ≤ 8 ms |
| Frame time (in game, reference machine) | S2, 5 minutes, heroes walking, loot flying | **≥ 99 % of frames ≤ 6.06 ms**; p99.9 ≤ 16.7 ms; **zero** Long Animation Frames > 50 ms |
| Frame time | S3 | ≥ 95 % of frames ≤ 6.06 ms (the torture test may bend, not break) |
| React | S2, heroes working but nobody walking | `MatBoard` ≤ 1 commit per second |
| React | S2, heroes walking | walking causes **no** `MatBoard` commits — positions are moved without React |
| Idle drawing | Empty mat, no particles | the frame loop does no work (no always-on canvas) |
| Memory | S6 headless 8 h | heap after GC within ±5 % of the 1-hour mark; every runtime map bounded |
| Memory | Tier C soak, 60 min | heap after GC ≤ +5 %; listener total and DOM node count unchanged ±2 % |
| Regression gate | every perf fix | before/after numbers in the ticket; `npm run bench -- --compare` green |

---

## 5. Session roadmap

**Fifteen sittings**: three preparation (P1–P3), ten review territories
(R1–R10, performance first), one hands-on certification (C), one synthesis (Z).
Round 2 ran nine; this round is larger because the board tripled in size and
two of the three preparation sittings build tools rather than read code.

**Ownership rule (carried from round 2):** each file belongs to exactly one
session. Other sessions read it freely, but file findings against it as stub
tickets tagged for its owner.

**Every review session ends with:** Session Status table updated, System Map
section filled for its territory, findings doc committed — and **no game code
changed**. Performance tickets carry a before-number from the bench.

### Preparation (before any review)

#### P1 — Clean baseline & round-2 re-triage *(reading only)*

- **Do:** on a clean `main`, record tests / lint / cycles / duplication /
  reachability / build size. Walk **all 74 open CR2 tickets** against the current
  tree: *moot* (grid-era, gone), *still open* (re-file as CR3 with the old number
  cross-referenced), or *fixed incidentally*. Archive round 2's docs to
  `archive/docs/`.
- **Risks:** the tree is shared with other sessions (the snapshot below was
  taken on a dirty `b9/hall-web`); several reworks mean several round-2 tickets
  name files that no longer exist.
- **Done when:** the CR2 backlog has zero unclassified tickets, and the baseline
  table in the findings doc is filled from a clean checkout.

#### P2 — Build Tier A: the headless benchmark *(build session)*

- **Do:** §4.1 — runner, fixtures, S1–S6, micro-benchmarks, `bench/baseline.json`.
  First run's numbers go into the findings doc as the round's starting line.
- **Risks:** the engine may assume a browser somewhere during boot
  (`AudioSystem`, `AssetPreloader`, `SettingsManager` storage). Stub those at the
  bench boundary; do **not** change them.
- **Done when:** `npm run bench` runs S1–S6 in under ~3 minutes, prints the
  table, writes JSON, and a deliberately-planted slowdown (e.g. a busy loop in
  one handler) is caught by `--compare`. *(House standard: prove the tool by
  breaking what it measures.)*

#### P3 — Build Tier B: stress scenarios + Perf HUD *(build session)*

- **Do:** §4.2 — scenario builders in the running game, HUD overlay,
  `window.__perf`, Profiler wrappers, copy-report button.
- **Risks:** the HUD must not become the thing it measures — it updates at most
  twice a second, off React for the numbers.
- **Done when:** an agent can start S2, wait 60 s and read a JSON report via
  `window.__perf.report()`; the owner can do the same with the button.

### Review territories (performance-first order)

#### R1 — Engine loop, clock & event bus

- **Files:** `src/systems/core/GameLoop.js`, `TimeManager.js`, `EventBus.js`,
  `EngineBootstrap.js` (the tick registry, `:195-244`), `SaveManager.js`
  (autosave cost), `DevTools.js`, `src/config/loopConstants.js`,
  `src/systems/board/BoardRunner.js` (the tick orchestration and Token loop),
  `src/systems/board/boardEvents.js`.
- **Key questions:** How much of a tick does each handler cost at S2/S3? Which
  events fire every tick, and do they need to (H5)? Should the tick be driven
  from the frame clock with an accumulator rather than `setInterval` (H6)? Is
  there a case to reintroduce event coalescing per tick (round 2's `EventBatch`
  idea, now deleted)? Does autosave serialise on the tick path, and how long does
  it take at 300 Tokens?
- **Expected risks:** H5 per-tick alert churn; autosave spikes; handler order
  dependencies that make batching unsafe.
- **Verification:** bench per-handler breakdown attached to every ticket;
  events-per-tick table for S2 recorded in the System Map.

#### R2 — Board state & spatial physics

- **Files:** `BoardState.js`, `nearby.js`, `MatPlacement.js`, `Placement.js`,
  `MatResize.js`, `MatCap.js`, `Restrictions.js`, `walking.js`, `HeroMotion.js`,
  `EnemyMotion.js`, `Hostiles.js`, `src/config/matGeometry.js`,
  `src/config/matTuning.js`.
- **Key questions:** How often is the Token list rebuilt per tick, and what would
  a cached, versioned list break (H1)? At what Token count does a spatial index
  (a uniform bucket grid of the mat) pay for itself (H3)? Is the 30-pass push
  solver bounded in the worst case? Does anything keep per-hero or per-enemy
  state that is never released when they leave (leaks)? Is `Placement` /
  `MatPlacement` a clean rules/geometry split (CR3-017)?
- **Expected risks:** hidden reliance on the fresh-array-every-call behaviour
  (callers that mutate the result); tie-break order (`placedAt`) that a cache
  must preserve exactly.
- **Verification:** micro-bench growth curves at 40/150/300; S4 push-storm
  worst-case recorded.

#### R3 — Work, flags & rule evaluation

- **Files:** `Flags.js`, `FlagRules.js`, `FlagColours.js`, `WorkCheck.js`,
  `RecipeResolver.js`, `RecipeBands.js`, `InputAllocator.js`, `Charges.js`,
  `StationRecipe.js`, `Foundations.js`, `TileModifiers.js`, `TriggerSystem.js`,
  `LoadoutMoments.js`, `EffectActions.js`, `EffectFeedback.js`, `BlockUpkeep.js`,
  `TimedChanges.js`, `SpawnerSystem.js`, `Shop.js`, `DiscardBin.js`,
  `UpkeepSummary.js`, `MatSummary.js`, `TokenGlows.js`, `TokenNotices.js`,
  `reachDisplay.js`.
- **Key questions:** How often does each flag re-search the whole mat (H2), and
  can "dirty" be narrowed to *what changed*? How expensive is a whole-mat
  modifier rebuild and how often does it happen (H4)? Is work checked once per
  Token per tick or several times (`BoardRunner` and `Flags` both call
  `WorkCheck`)? Are the RecipeResolver crash paths from the handoff (§8.1) fixed?
- **Expected risks:** the richest seam for "wired at one end only" (round 2's
  primary objective) — Token Lifecycle added many rules quickly.
- **Verification:** S5 rebuild-storm numbers; rebuilds-per-tick counter.

#### R4 — Combat, heroes, effects & loot

- **Files:** `BoardCombat.js`, `DealDamage.js`, `StatusApplication.js`,
  `BoardPromotion.js`, `SpriteLayer.js`, `src/systems/combat/`,
  `src/systems/effects/`, `src/systems/hero/`, `src/systems/equipment/`,
  `src/config/FormulaRegistry.js`.
- **Key questions:** Allocation per attack and per loot drop at S3; is
  `SpriteLayer`'s loot list bounded under a flood; does `LiveEffects` scale with
  effect count; do statuses and live effects still run as two systems (memory:
  Effects Robustness ER-list)?
- **Expected risks:** loot floods creating hundreds of page elements; per-attack
  event fan-out to every hero component (`MatHero.jsx:32`, CR3-022).
- **Verification:** S3 per-handler numbers for `sprite_layer`, `live_effects`,
  `status_effects`, `wounded_system`.

#### R5 — The UI ↔ engine boundary & render cascades

- **Files:** `src/ui/hooks/` (6), `src/ui/context/` (2), `src/ui/ReactRoot.jsx`,
  and — as a *sweep* across all of `src/ui/` — every `useGameState` call (27) and
  every `EventBus.subscribe`.
- **Key questions:** Which components commit per tick at S2 and why (R2, R3)?
  Is `state_changed` (31 publishers) the right tool anywhere, or should every
  publisher name what changed? Can `useGameState` avoid running N selectors for
  one event (per-id subscriptions)? Is every subscribe paired with an
  unsubscribe (round 1/2's sweep, not repeated since)? Does any component
  enforce a game rule?
- **Expected risks:** changing a selector's contract silently stops a component
  updating (the CR-044 footgun documented in `useGameState.js`).
- **Verification:** React Profiler commit counts per surface, before numbers
  recorded; the subscription-pair table in the System Map.

#### R6 — The mat renderer: paint, layout & composite

- **Files:** `src/ui/components/board/` (46), `src/ui/components/base/`
  `ParticleOverlay.jsx`, `TokenSprite.jsx`, `FPSCounter.jsx`, and the CSS under
  `src/styles/` that the mat uses.
- **Key questions:** How much frame time is layout vs paint vs composite at S2
  (Performance panel)? What does switching walking from `left/top` to
  `transform` save (R1)? Can the per-Token timers become one shared frame clock
  (R5)? Should the particle canvas sleep when empty (R4)? What do the filters
  cost (R6)? **Where is the element-count ceiling — and is a canvas mat
  needed at all (§2.F)?** Rewrite `PERFORMANCE.md` for the mat era.
- **Expected risks:** visual regressions the owner must judge by eye (glows,
  slides, bubble placement); screenshots don't work, so any visual claim needs
  the owner's eyes.
- **Verification:** Perf HUD frame histograms at S2/S3; Long Animation Frame
  attributions; each "cheap fix" hypothesis sized by a **throwaway spike** (see
  Q4) rather than guessed.

#### R7 — Drag & drop and input

- **Files:** `src/ui/dnd/` (3), `dropOnMat.js`, `matPoint.js`,
  `useDisallowMode.js`, `useBoardScale.js`, `useMatSize.js`, pointer handlers in
  `MatBoard.jsx` / `FlagLayer.jsx`.
- **Key questions:** Do the `PERFORMANCE.md` drag rules (pointer events dead
  during drag, CSS-only hover highlights, frame-throttled collision) still hold
  after the mat rework? What runs per pointer-move during a drag at 150 Tokens?
  Does `getBoundingClientRect` run per move?
- **Expected risks:** drag is unreliable to simulate — DnD findings need the
  owner's own hands (round 2 lesson).
- **Verification:** Perf HUD during an owner-performed drag across a full mat.

#### R8 — UI/UX consistency across surfaces

- **Files:** `src/ui/components/dock/`, `drawer/`, `hud/`, `nav/`, `hero/`,
  `src/ui/modals/`, `base/` (except ParticleOverlay), `MatTuner.jsx`,
  `MatTopBar.jsx`, tooltips (`tooltipPlacement.js`, `TrickleTooltip.jsx`,
  `QuestTooltip.jsx`), toasts.
- **Key questions:** One modal behaviour (open/close/escape/backdrop)? One
  tooltip system or several? Typography and spacing tokens applied
  consistently? z-index layers from one table (`matLayers.js`) or scattered?
  Which dev surfaces are still intentional (round 2 Q5 kept four; new ones since)?
- **Expected risks:** taste calls — every finding here is a **question for the
  owner**, not a defect, unless it is plainly inconsistent.
- **Verification:** an inventory table (surface × modal/tooltip/type/z-layer)
  in the findings doc for the owner to rule on.

#### R9 — Vestiges, documentation & layer separation

- **Files:** the 393 *tile* hits and 20 *tray* files (classification only);
  `src/tests/FreeMatGuards.test.js` allow-lists; `.agent/guides/`,
  `.agent/workflows/`, root and `docs/` markdown; `src/config/` (37 files) for
  the config / engine / presentation split; `tools/reachability.mjs` output;
  and the build — `vite.config.js`, `eslint.config.js`, `package.json`
  dependencies, bundle composition (CR3-025, CR3-026; added by P1).
- **Key questions:** For every tile/tray hit: residue, save-compatibility, or
  legitimate (terrain, Guild Hall board, sprite sheets — §2.D)? Which docs are
  history (archive), which are live but wrong (rewrite), which are live and right?
  Does anything in `src/config/` contain engine logic, or any engine file hold
  content that belongs in config/CMS?
- **Expected risks:** the reachability tool's three known lies (round 2 guide) —
  grep `src/`, `cms/src/` and `src/tests/` and check exported *symbols* before
  calling anything dead.
- **Verification:** a classification table with a verdict per file; nothing
  filed for deletion without all three greps.

#### R10 — Expansion readiness & test coverage

- **Files:** read-across, not a territory: the hero body/motion model
  (`HeroMotion`, `walking.js`, `Flags` state machine), the terrain stack
  (`Terrain*.js`, `terrainRegistry`), `boardEvents.js` as the contract registry,
  `src/tests/`.
- **Key questions:** For Stage 2 (autonomous heroes): where would a hero's
  "decide what to do next" live, and does `Flags` already own it? Is there one
  hero state machine or several flags scattered across modules? For Stage 3
  (living mat, biomes): can a new biome be added through content alone? Which
  module boundaries have no contract (payload shapes undocumented)? Would
  `// @ts-check` + JSDoc types on the board modules catch real bugs cheaply?
  Which risky fixes from R1–R9 lack a test to stand on?
- **Expected risks:** designing Stage 2 by accident — this session **describes
  seams, it does not design features.**
- **Verification:** a seam map and a coverage-gap list keyed to R1–R9 tickets.

### Certification & synthesis

#### C — Runtime certification (hands-on)

- **Do:** run the full §4.4 table on the reference machine (with the owner if it
  is their PC); the 60-minute soak; then try every player-facing ticket from
  R1–R10 in the running game. Record which were confirmed by running and which
  only by reading.
- **Done when:** every §4.4 row has a number, a pass/fail and a date. This is the
  "before" line the fix waves are judged against.

#### Z — Synthesis & fix waves

- **Do:** turn the tickets into ordered fix waves by the §6 formula. Propose the
  waves; the owner approves them. **Tests before risky fixes** (round 2's rule).
- **Likely wave shape** (to be confirmed by the numbers): **Wave 1 — cheap
  frame wins** (transform-based movement, sleeping particle canvas, one frame
  clock); **Wave 2 — engine allocation** (cached Token list, narrowed flag
  dirtiness, alert de-duplication); **Wave 3 — render cascade** (targeted events,
  per-id subscriptions, memoisation); **Wave 4 — spatial index** *only if*
  S3 demands it; **Wave 5 — vestige & docs purge**; **Wave 6 — UX consistency**
  per owner rulings.

---

## 6. Scoring & triage

### 6.1 Severity and effort — unchanged from rounds 1 and 2 *(owner-approved)*

| Severity | Meaning |
|---|---|
| **P0** | Broken or dangerous now: save loss, crash, a leak that degrades long sessions |
| **P1** | A player could hit it: a bug, or a measured miss of a §4.4 target |
| **P2** | Architecture / maintainability debt, or a *reasoned* perf risk not yet shown to miss a target |
| **P3** | Polish: naming, style, minor cleanup |

**Effort:** S (< 1 hour) · M (a session) · L (multi-session).

**New rule for performance tickets:** a perf ticket is **P2 until measured**. It
becomes P1 only when a bench or HUD number shows it missing a §4.4 target. This
stops a list of hunches outranking real bugs.

### 6.2 Category codes *(new this round)*

| Code | Category | Pillar |
|---|---|---|
| `HPB` | Hot-path bloat — engine CPU per tick | 1 |
| `GC` | Allocation / garbage-collector churn | 1 |
| `RC` | React render cascade | 1 |
| `PNT` | Layout / paint / composite cost | 1 |
| `ML` | Memory or listener leak | 1 |
| `DC` | Dead code — nothing reaches it | 2 |
| `VES` | Vestigial concept or vocabulary (tile, tray, card…) | 2 |
| `DOC` | Stale or misleading documentation | 2 |
| `LAY` | Layer violation — rule in UI, React in engine, logic in config | 2 |
| `WIRE` | Wired at one end only (round 2's primary finding type) | 2 |
| `CON` | Contract drift — event payloads, schemas, save shape | 3 |
| `EXT` | Blocks Stage 2 / Stage 3 | 3 |
| `TST` | Test coverage gap under a risky fix | 3 |
| `UX` | Inconsistent presentation or behaviour | 4 |

### 6.3 Priority within a tier

**Score = Impact × Confidence ÷ Effort**, used only to order tickets *inside* a
severity tier.

- **Impact 1–5**: 5 = blocks a §4.4 target or risks saves; 4 = visible to the
  player; 3 = slows every future feature; 2 = local debt; 1 = cosmetic.
- **Confidence**: 1.0 = measured or reproduced in game · 0.6 = reasoned from
  code · 0.3 = suspected.
- **Effort**: S = 1 · M = 2 · L = 4.

**Risk** is recorded separately (low / medium / high — the chance the fix breaks
something) and is a **gate, not a score**: a high-risk ticket cannot enter a fix
wave until the test it needs exists (`TST` link).

### 6.4 Baseline snapshot taken during planning

Taken 2026-09-27 on branch **`b9/hall-web` with another session's uncommitted
work in the tree** — so it is *indicative only*; P1 re-takes it on clean `main`:
**3,691 passed / 15 failed / 29 skipped, 226 files.** The last recorded clean
baseline (memory, 2026-09-26) was 10 known failures.

---

## 7. Ground rules

Inherited from round 2 (these worked; don't renegotiate them):

- **Review sessions change no game code.** Findings go in the tracker. The only
  exceptions are the tooling build sessions P2/P3 and throwaway spikes (Q4).
- **Ask, don't assume — as multiple choice**, with a recommendation first.
- **The owner doesn't code.** Session reports in plain language: what's wrong,
  why a player would care, roughly how big.
- **One session per sitting.** Update the Session Status table, fill the System
  Map, commit the findings doc.
- **Evidence over vibes.** `file:line` for every finding. **For performance: a
  number, from the bench or the HUD, or the ticket says "reasoned".**
- **A green suite is not a working game.** Player-facing claims are tried in the
  game, and the ticket says whether they were.
- **Never hand-edit `data/*.json`.** Scenarios register fixtures at runtime.
- **Concurrent sessions share this checkout.** Check the branch and
  `git status` before committing; stash before blaming yourself for red tests.
- **No double quotes in `git -m` messages** in this PowerShell.

New this round:

- **Locked decisions may be challenged — with numbers.** The owner has invited
  it. A ticket that argues against a locked decision cites the decision id,
  shows the measurement, offers options, and lets the owner rule. It never just
  reverses it.
- **Do not frame findings around scaffolding that is gone.** There are no tiles
  on the mat (handoff lesson). Name things by Token instance and mat point.
- **Frame numbers from the agent's preview pane don't count** (§3.5).

---

## 8. Session kickoff prompt

> I'm continuing the round-3 code review.
>
> 1. Read `CLAUDE.md`.
> 2. Read `code_review_v3_master_plan.md` — scope, pillars, scoring and session
>    plan are settled; don't re-propose the method.
> 3. Open `code_review_v3_findings.md`, check the Session Status table, tell me
>    which session is next and its territory. Read the existing CR3 tickets for
>    that territory first.
> 4. Confirm the branch and that the tree is clean; other chats share it.
> 5. Run `npm run bench` (from P2 onward) and the tools the plan assigns, over
>    your territory, before reading blind.
> 6. Verify the territory's file list against the tree and report any drift.
>
> Then stop and confirm scope with me. File tickets, don't change game code.
> Plain language in the report. Commit the findings doc at the end.

---

## 9. Questions for the owner

### Owner rulings — 2026-09-27

| Q | Ruling |
|---|---|
| **Q1** | **(A) Drawing at 165; rules stay at 10 ticks a second.** CR3-006 stays P3 and is not to be pursued as a tick-rate change. |
| **Q2** | **(A) The owner's own PC is the reference**, certified by frame-time budget, with one final confirmation on a 165 Hz screen. No minimum-spec or Linux pass this round. |
| **Q3** | **(A) §4.4 targets and scenario sizes approved as written**, to be revisited once P2's first run gives real numbers. |
| **Q4** | **(A) Throwaway spikes allowed** — scratch branch, measured, deleted, never merged. Record the numbers in the ticket. |
| **Q5** | **(A) P1 re-triages round 2's open tickets**; survivors re-filed as CR3 with the CR2 number cross-referenced; round 2's docs move to `archive/docs/`. *(Owner, 2026-09-28.)* |
| **Q6** | **(A) Commit on a short `review-v3-plan` branch off `main` once the other session has finished**, then merge. *(Owner, 2026-09-28.)* |

The original options are kept below for the record.

**Q1 — What exactly must run at 165?**
- **(A) Recommended: drawing at 165, rules stay at 10 per second.** Movement is
  smoothed between ticks. Cheapest, and matches how the game already works.
- (B) Raise the engine to 30 ticks a second as well — smoother combat timing,
  3× the engine budget pressure, touches every per-tick constant.
- (C) Run the engine on the frame clock — most responsive, biggest change,
  ties game speed to the monitor unless carefully decoupled.

**Q2 — Which machine and screen certify it?**
- **(A) Recommended: your own PC as the reference, measured by frame-time
  budget; one final confirmation on a 165 Hz screen.**
- (B) A deliberately weak "minimum spec" laptop as well — safer for Steam
  reviews, costs a second certification pass.
- (C) Also Steam Deck / Linux — a different browser engine underneath (§2.C);
  adds a whole platform to certify.

**Q3 — The certification numbers in §4.4 and the scenario sizes (S2 = 8 heroes,
~100 Tokens; S3 = 300 Tokens).**
- **(A) Recommended: approve as written**; revisit after P2's first run.
- (B) Make S2 bigger (e.g. the 200-Token cap filled) — stricter, may force the
  canvas question early.
- (C) Relax S3 to "must not crash or leak" only — lighter, but hides where the
  cliff is.

**Q4 — May reviewers run throwaway experiments?**
- **(A) Recommended: yes — a "spike" on a scratch branch, measured, then
  deleted, never merged.** It is the only honest way to size a lever like
  `left/top → transform` before ranking it.
- (B) No — reading only, sizes are estimates. Purer, but the wave plan will
  rest on guesses.

**Q5 — Round 2's 74 open tickets.**
- **(A) Recommended: P1 re-triages them; survivors are re-filed as CR3 with the
  old number cross-referenced; round 2's docs move to `archive/docs/`.**
- (B) Close them all and let round 3 rediscover what matters — cleaner, risks
  losing real bugs.
- (C) Keep both trackers live — no work now, two sources of truth later.

**Q6 — Where should these two documents live, given another session is mid-work
on `b9/hall-web`?**
- **(A) Recommended: leave them uncommitted until that session merges, then
  commit them on a short `review-v3-plan` branch off `main` and merge.**
- (B) Commit now on a new branch off `main` (safe — a new branch doesn't disturb
  the other session's files, but needs a careful checkout in a shared tree).
- (C) Commit onto `b9/hall-web` — fastest, but mixes the plan into someone
  else's feature branch.

---

## ⚠ Keeping this document honest

Round 2's guide drifted three times in a day because code kept moving under it.
**Before each session, verify its file list against the tree and report drift
rather than working around it.** Treat both this plan and the pre-filed tickets
as evidence to check, not truth to inherit — every pre-filed ticket
(CR3-001…022) was written from reading, not measuring.

---

## 10. Director mode — the autonomous run *(owner interview, 2026-09-28)*

From 2026-09-28 the owner is away for ~20 hours. One **director** agent runs the
review by dispatching **subagents**, and moves on to easy-win fixes if the
review finishes. These rulings override anything above that conflicts.

| Topic | Owner ruling |
|---|---|
| **Easy wins** (after the review) | **Small + safe + proven only**: effort S, risk low, **not a design choice**, and provable by tests or the benchmark. Invisible speed fixes are allowed (e.g. the particle canvas sleeping when empty). **Nothing that changes how the game looks or plays.** ⭐ **Widened 2026-09-30** (owner interview, `docs/review_v3/Z.md` §11): **exact engine speed fixes rated medium risk are allowed** when proven by named tests and the bench's identical-work gate; **visible-bug fixes that only restore intended behaviour may be batched** (stale HP bars, dead buttons), but **any bug that could be a design choice is asked first**; the drawing batch waits for the owner's eye-check before it is kept. |
| **Merging** | Each piece of work on its own branch; **merged to `main` only when verified**: test baseline unchanged (the same 10 known failures, or fewer) and, for speed work, `npm run bench -- --compare` does not regress. **Never push to GitHub.** |
| **Blocked on an owner question** | **Park it and keep going.** Write it to the questions list in `docs/REVIEW_V3_RUN_LOG.md` (multiple choice, recommendation first), skip that item, carry on. |
| **Shared folder** | Nobody else will work in the checkout. Work in the main folder. |
| **Session C (certification)** | **Prepare it; the owner runs it.** Measure what the preview pane can, labelled *not representative*, and write a ~15-minute step-by-step checklist using the Perf HUD's copy-report button. |
| **Git LFS (CR3-027)** | **Do it first**, excluding `public/assets/archive/` and `public/assets/maybe/` (7 small files; ask later). |
| **Palette files** (`data/palettes/*.json`) | **Commit them as-is**, on their own commit. |
| **Parallelism** | **Review sessions in parallel (3–4 at a time); code changes one at a time** (tooling builds, spikes that touch the tree, fixes), so the test baseline stays trustworthy. |
| **Updates** | Running log in `docs/REVIEW_V3_RUN_LOG.md`, plus a phone notification at milestones: benchmark built, review complete, each fix wave merged. |

### How parallel review sessions avoid colliding

- **Each R-session writes its own file**, `docs/review_v3/Rn.md`, never the
  shared findings doc. The director merges them into
  `code_review_v3_findings.md` and commits.
- **Ticket number ranges** so no renumbering is needed: R1 `CR3-100…149`,
  R2 `150…199`, R3 `200…249`, R4 `250…299`, R5 `300…349`, R6 `350…399`,
  R7 `400…449`, R8 `450…499`, R9 `500…549`, R10 `550…599`, C `600…649`.
- **Review sessions change no files outside their own `Rn.md`.** Throwaway
  spikes (Q4) run in a **separate git worktree** (now faithful, because the art
  is in git after CR3-027), measured, then deleted — never in the main folder.
  ⚠ If a worktree gets a `node_modules` junction, remove the junction with
  `cmd /c rmdir` **before** removing the worktree, or the real packages go too.
- A session that finds a pre-filed CR3 ticket in its territory **updates it by
  writing a verdict line in its own `Rn.md`** (confirmed with a number /
  closed / changed); the director applies it.
