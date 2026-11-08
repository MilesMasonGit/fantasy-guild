# Fantasy Guild — Architecture

**Status:** reference, the map of the code **as it is** on `main` (v0.8.0, save schema 0.8.1).
**Checked against code:** 2026-11-06, commit `93338609` (branch `prep/ar`). Every claim below
carries a `path:line` or `path`; where something was reasoned rather than read, it says
**unverified**. Code wins if this document disagrees; fix the document.

Read this before reviewing or optimising. Many comments and older docs in this repo describe
machinery that is gone (§8); `CLAUDE.md`'s rule holds: a comment is a hypothesis, not evidence.

---

## 1. One-screen summary

```
Tauri window (src-tauri/, Rust)    save files, save-on-close, "window minimised" signal
 └─ WebView2 page: index.html → src/main.jsx
     ├─ Engine (src/systems, src/state, src/config)
     │    GameLoop: setInterval every 100 ms → 7 tick handlers, fixed order
     │    → mutate GameState.state IN PLACE → EventBus.publish(...)
     ├─ React UI (src/ui)
     │    reads GameState through hooks/subscriptions; Tokens, heroes, flags are DOM elements
     │    positioned on a free playmat; walkers move by CSS transform transitions
     ├─ Mat drawing clocks (ui/components/board/frameClock.js)
     │    10-a-second step for rings, per-sprite due times for animation frames;
     │    paused while the window is hidden or minimised (the tick keeps running)
     └─ Canvases: ground picture (TerrainCanvas, rebuilt only on change), ambient life (8/s),
          loot particles (only while flying), world map (painted in a Web Worker)
```

| Layer | One sentence |
|---|---|
| **Tauri shell** | A thin Rust host: seven save-file commands, a save-before-close handshake and a minimise event for the page (`src-tauri/src/lib.rs:22-48`, `src-tauri/src/saves.rs`). |
| **Engine tick** | `GameLoop` runs registered handlers on `setInterval(…, 100)` (`src/systems/core/GameLoop.js:34`, `src/config/loopConstants.js:7`); seven handlers are registered, all in `EngineBootstrap._registerTickHandlers` (`src/systems/core/EngineBootstrap.js:164-209`). |
| **State** | One mutable object, `GameState.state`, owned by a singleton facade (`src/state/GameState.js:19-167`); its shape is `INITIAL_STATE` (`src/state/StateSchema.js:138`). |
| **Content** | `data/*.json` is bundled at build time by `import.meta.glob` (`src/config/DatabaseManager.js:4-31`) and turned into registries in `src/config/registries/`. |
| **Event bus** | One singleton pub/sub (`src/systems/core/EventBus.js:167`) with event names declared in two catalogues (`src/systems/core/engineEvents.js`, `src/systems/board/boardEvents.js`). |
| **React UI** | Mounted once after art preload (`src/main.jsx:97-108`); root component `src/ui/ReactRoot.jsx`. |
| **Drawing** | DOM elements per Token/hero (`src/ui/components/board/MatBoard.jsx`), a few canvases, and shared clocks that pause when the window is hidden (`src/ui/drawingPause.js`). |

Boot order (`src/main.jsx:27-127`): settings load (`:58`), SaveManager init (`:59`), save files
read (`:61`), `EngineBootstrap.init()` wires every engine subscription and the tick handlers
(`:91`), the drawing pause is installed (`:94`), React mounts once art, sprite effects and save
files are ready (`:97-108`). **The loop does not start at boot**: it starts when a save slot is
opened (`EngineBootstrap.startSlot` → `onSlotSelected` → `GameLoop.start()`,
`src/systems/core/EngineBootstrap.js:293-354`), called from the slot screen
(`src/ui/ReactRoot.jsx:83`).

---

## 2. Module map

Sizes are non-test `.js`/`.jsx` lines on 2026-11-06. `src/` holds **115,131** such lines
outside `src/tests/` (627 test files, ~139k lines, live in `src/tests/`). "Depends on" is the
top folders by import count from `npm run depcruise` (JSON output, 615 modules, 3,748 edges).

| Folder | Files / lines | Owns | Entry file(s) | Depends on |
|---|---|---|---|---|
| `src/main.jsx` | 1 / 127 | Boot sequence (§1). | — | systems/core, ui |
| `src/config/` | 50 / 9,828 | Content registries (`registries/`, 38 files), tuning tables, combat numbers (`FormulaRegistry.js`), the Hall upgrade web (`guildUpgrades.js`), the mat-size dev tuner stored in localStorage (`matTuning.js`). | `DatabaseManager.js`, `registries/tokenRegistry.js`, `registries/itemRegistry.js` | systems/effects (14 edges), systems/atlas (3) — see §7 |
| `src/i18n/` | 1 + `en.json` / 72 + 568 | On-screen strings, `t()`; every `*.json` beside it is a language (`src/i18n/index.js:5-8`). | `index.js` | utils |
| `src/state/` | 2 / 543 | The save's shape and validation (`StateSchema.js`), the live store and serialisation (`GameState.js`). | `GameState.js` | utils; nothing in systems (§7) |
| `src/utils/` | 6 / 606 | Logger, RNG, formatters, XP curve, sprite path resolution (`AssetManager.js`). | — | config (2 edges) |
| `src/systems/core/` | 29 / 6,080 | Loop, clocks, bus, saves, catch-up, settings, audio, content audits (`ContentAudit.js`, `lifecycleAudit.js`, `*Rule.js`). | `EngineBootstrap.js`, `GameLoop.js`, `SaveManager.js`, `CatchUp.js` | config, board, effects, utils |
| `src/systems/board/` | 61 / 15,862 | The playmat: Token storage (`BoardState.js`), placement rules and geometry (`Placement.js`, `MatPlacement.js`), hero orders (`Flags.js`), walking (`HeroMotion.js`, `EnemyMotion.js`), work cycles (`BoardRunner.js`), modifier caches (`TileModifiers.js`), combat on the mat (`BoardCombat.js`), timed changes and spawners (`TimedChanges.js`, `SpawnerSystem.js`), loot sprites (`SpriteLayer.js`). | `BoardRunner.js` | config (146), core, effects, hero, state |
| `src/systems/effects/` | 11 / 3,573 | The statement grammar (`statements.js`), its text (`statementText.js`), modifier math (`ModifierAggregator.js`), live statuses (`LiveEffects.js`), content id migrations. | `statements.js`, `LiveEffects.js` | config |
| `src/systems/hero/` | 15 / 1,613 | Hero records, generation, regen, skills, consumption, rehydration. | `HeroManager.js` | config, core, effects |
| `src/systems/combat/` | 9 / 1,157 | Attack resolution and the combat maths (`CombatFormulas.js`), loot rolls, wounded clock, defeat penalties. | `CombatProcessor.js`, `WoundedSystem.js` | config, core, utils, hero |
| `src/systems/equipment/` | 7 / 727 | Gear and tools held by heroes, breakage, starter tools. | `EquipmentManager.js` | config, state |
| `src/systems/inventory/` | 5 / 729 | The Bank: add/remove, tabs, rate tracking. | `InventoryManager.js` | utils, config, core |
| `src/systems/atlas/` | 15 / 5,296 | Regions and travel (`Atlas.js`), Region generation from map ingredients (`Budget.js`, `Layout.js`, `WaterShapes.js`), the Starter Camp. | `Atlas.js` | config, board, core |
| `src/systems/world/` | 13 / 2,193 | The run's hex world map, generated once at a new game (`generate.js`), settling cells (`Settling.js`, `Arrival.js`). | `World.js` | config, atlas, board |
| `src/systems/progression/` | 8 / 2,119 | Guild Hall upgrades (`GuildUpgradeManager.js`), discoveries and the collection log, and **`ledger/`** (`engine.js`, `plan.js`): the Encyclopedia's reach engine, which the CMS's economy simulator (`cms/src/engine/ledger/`) also uses (§2.1). | `GuildUpgradeManager.js`, `ledger/engine.js` | config, effects, core, world |
| `src/systems/quests/` | 5 / 1,194 | Tutorial chain and bounty quests, which are Tokens on the mat (`QuestTokens.js`). | `QuestManager.js` | config, board |
| `src/systems/notifications/` | 6 / 1,018 | Banners and item stubs as small module stores; `routing.js` decides where each engine event goes. | `routing.js` (wired by `core/NotificationSubscriptions.js`) | config, core, state |
| `src/ui/ReactRoot.jsx` + root files | 3 / 528 | Root component; `drawingPause.js`; `guildInspectSelection.js`. | `ReactRoot.jsx` | ui/components (32), hooks |
| `src/ui/components/board/` | 133 / 23,381 | The mat as drawn: `MatBoard.jsx`, `MatToken.jsx`, `MatHero.jsx`, `TerrainCanvas.jsx`, `AmbientLife.jsx`, the frame clocks, flags, bubbles, fx; the ground-picture painters and their dev tuner (`terrain/`, §5.3); also the Guild Hall sky (`GuildHallBoard.jsx`, `HallSky.jsx`). | `Board.jsx`, `MatBoard.jsx` | systems/board, config |
| `src/ui/components/` (other) | 105 / 18,334 | `atlas/` (Atlas and world map, 3,104), `base/` (shared widgets, 2,660), `combat/` (2,420), `encyclopedia/` (2,513), `drawer/` (Bank, 2,357), `dock/` (hero bar, 1,963), `notifications/` (930), `hud/`, `nav/`, `title/`, `dev/` (792), `TestDashboard.jsx` (the QA panel host, 439). | — | config (201 edges), systems/board (170), systems/core (92) |
| `src/ui/dev/` | 74 / 9,898 | QA panel sections and fixtures, the Perf HUD and stress boards (`perf/`). Rendered only in dev or perf builds (`src/ui/ReactRoot.jsx:427-436`, `src/main.jsx:115-117`). | `perf/perfHarness.js` | systems/board, config, core |
| `src/ui/hooks/`, `context/`, `dnd/`, `modals/`, `utils/` | 12/838, 1/36, 4/946, 4/814, 7/834 | Store hooks (`useGameState.js`, `structuralShare.js`), the viewport motion values, dnd-kit wiring (`DndKit.jsx`), slot/settings/hero modals, hit-testing and loot flight helpers. | `hooks/useGameState.js`, `dnd/DndKit.jsx` | systems/core, ui/components |
| `src/styles/`, `src/tailwind.css` | 3 CSS files / 1,851 | Tailwind v4 plus hand CSS; 27 `@keyframes`. | — | — |

### 2.1 What the tooling says about dead code

- **knip** (`npm run dead-code`, config `knip.json`): **15 unused files** (all in `bench/` and
  `tools/`, none in `src/`), **201 unused exports** (98 in `src/ui/components`, 29 in
  `src/ui/dev`, 14 in `src/config/registries`, the rest spread), **158 duplicate exports**
  (mostly a named export beside `export default` of the same thing), 1 unused dependency
  (`@dnd-kit/modifiers`), 2 unlisted (`picomatch` in one test, `@vitest/coverage-v8`), 1 unlisted
  binary (`dot`, used by `npm run depcruise:graph`). Exit code 1. Nothing was deleted.
- **knip's two blind spots, measured.** (1) `knip.json` makes every test file an entry, so a
  module used only by tests counts as used. (2) It ignores `cms/**`, and the CMS imports **62
  distinct game modules** by relative path (counted from `cms/src` and `cms/*.js`), so an
  export the CMS alone uses is reported unused.
- **Reachable from `src/main.jsx`** (depcruise graph, static and dynamic edges): 584 of 599
  `src` modules. The 15 that are not, ~7,160 lines:
  - CMS-only: none since the twelve ledger files (`balance`, `pace`, `rates`, `profiles`,
    `world`, `checks`, `economy`, `settings`, `hall`, `calibration`, `statementSlots`,
    `tempoBands`) moved to `cms/src/engine/ledger/`; game tests still import some of them
    (`statementSlots` above all), but nothing under `src/` outside `src/tests/` does.
  - Loaded another way: `src/ui/components/atlas/worldPicture.worker.js` (a Worker made with
    `new URL(…)`, `src/ui/components/atlas/WorldMap.jsx:100`).
  - **Imported by tests only**: `src/ui/dev/terrainDev.js`.
    Candidates for the review, not verdicts.

---

## 3. The tick

### 3.1 How time advances

- **Wall clock → delta.** `TimeManager.update()` reads `performance.now()`, floors the delta at
  0 and clamps it to `MAX_TICK_DELTA_MS` = 1000 (`src/systems/core/TimeManager.js:43-54`,
  `src/config/loopConstants.js:23`); the clipped remainder is parked as overflow
  (`TimeManager.js:50`).
- **The loop.** `GameLoop.start()` calls `setInterval(() => this.tick(), 100)`
  (`src/systems/core/GameLoop.js:34`). Each `tick()` takes the delta, publishes `TIME_OVERFLOW`
  when there is overflow (`GameLoop.js:66-71`), then `runHandlers(delta)` calls every handler in
  priority order inside its own `try/catch` (`GameLoop.js:85-96`). Older notes say "TICK_INTERVAL"; it is
  `TICK_INTERVAL_MS` in code.
- **Game time.** `state.time.gameTimeMs` grows by each delta in the first handler
  (`EngineBootstrap.js:166-172`). Rules that compare moments read `GameClock.now()`, which is
  `Date.now()` live and a stepped clock during a catch-up (`src/systems/core/GameClock.js:17-39`;
  `src/tests/RulesUseGameClock.test.js` lists who may use `Date.now()`).
- **Fast-forward.** `GameLoop.runHandlers(delta)` is public so the catch-up (§4.4) and the dev
  time-skip (`DevTools.advanceTime`, `src/systems/core/DevTools.js:83-101`) feed the same handlers
  synthetic deltas (`GameLoop.js:76-85`).

### 3.2 What runs per tick, in order

All registered in `src/systems/core/EngineBootstrap.js:164-209`; every handler is skipped until
`GameState.getIsInitialized()`. No other code calls `GameLoop.onTick` (grep, 2026-11-06).
Order is pinned by `src/tests/TickHandlerOrder.test.js`.

| Pri | Handler | What it does |
|---|---|---|
| 10 | `time_tracking` | `gameTimeMs += delta`, `meta.totalPlaytime += delta` (`EngineBootstrap.js:166-172`). |
| 20 | `live_effects` | `LiveEffects.tick`: accumulates delta and fires statuses for all bearers once every 3 s (`src/systems/effects/LiveEffects.js:549-555`, `STATUS_TICK_INTERVAL_MS` at `src/config/FormulaRegistry.js:174`). |
| 30 | `regen_system` | Hero regeneration (`src/systems/hero/RegenSystem.js:23`). |
| 40 | `board_runner` | `BoardRunner.tick` (`src/systems/board/BoardRunner.js:469`), below. |
| 50 | `quest_manager` | Bounty clock and quest Tokens (`src/systems/quests/QuestManager.js:263-265`). Must run after the board (comment at `EngineBootstrap.js:187-198`). |
| 60 | `sprite_layer` | Loot sprites on the floor (`src/systems/board/SpriteLayer.js:518`). |
| 70 | `wounded_system` | Wounded heroes' recovery clock (`src/systems/combat/WoundedSystem.js:42`). |

Inside `BoardRunner.tick` (`src/systems/board/BoardRunner.js:469-…`): untethered enemies join
camps (`:478`) → `TimedChanges.tick` (growth, turning, **spawners** — a spawner's turn is a timed
change, `src/systems/board/TimedChanges.js:298`) (`:484`) → `Flags.assign` (heroes keep, change
or find work) (`:494`) → `HeroMotion.tick` (`:499`) → `EnemyMotion.tick` (`:503`) → then one pass
over every Token on the mat (`:511`): effect-block upkeep (`:522`), trigger cooldowns (`:529`),
enemies run `BoardCombat.tickToken` (`:550`), demolition, otherwise the work cycle (start,
progress, completion). `BOARD_EVENTS.PROGRESS` is published only every 3rd tick
(`PROGRESS_EVERY = 3`, `BoardRunner.js:83`, `:733`).

Other timers that are not the tick: the autosave `setInterval` (default 10 minutes,
`src/systems/core/SaveManager.js:204`, `src/systems/core/SettingsManager.js:18`), the
notifications fade timer (`src/systems/notifications/routing.js:54`), and the UI's poll clock
(`frameClock.onPoll`, one timer for every readout that re-reads the game on a clock, §5.4).

### 3.3 The event bus

- **One bus**: `EventBus` (`src/systems/core/EventBus.js:15-167`), a `Map<name, Set<fn>>`,
  synchronous delivery in subscription order, each callback in `try/catch` (`:96-107`). There
  is no queue and no batching on the bus itself.
- **Names, two catalogues**: `ENGINE_EVENTS` (43 names), `UI_EVENTS` (10), `NO_LISTENER` (7
  published, never subscribed) in `src/systems/core/engineEvents.js`; every declared name has a
  publisher; `BOARD_EVENTS` (32 names) and
  `ALERT` (17) in `src/systems/board/boardEvents.js`. Raw-string event names are refused by
  `EngineEventNames.test.js` and `BoardEventNames.test.js`. Counts are from importing the
  modules (2026-11-06).
- **Who publishes**: `EventBus.publish(` appears 268 times outside tests: 189 in the engine
  (`systems`, `state`, `config`, `utils`), 28 in `src/ui` outside `ui/dev` (UI events, `audio:play`, and the
  QA panel `TestDashboard.jsx:164,262,275`), 51 in `src/ui/dev`. The rule "the UI never
  publishes an engine event" except dev panels is in `engineEvents.js:12-16` and enforced by
  `UiEventOwnership.test.js`.
- **Who subscribes**: `EventBus.subscribe(` 79 times in the engine and 79 in the UI (73 outside
  `ui/dev`), plus every `useGameState` call (about 25 sites in 16 files) and the per-Token switchboard
  (`src/ui/components/board/tokenEvents.js`: one bus subscription per event type, routed by
  `instanceId`, `:20-80`).
- **Quiet mode** for the catch-up: UI listeners subscribe with `UI_LISTENER`
  (`EventBus.js:13`, enforced by `UiListenersTagged.test.js`); `setQuiet(true)` delivers only to
  untagged engine listeners, except `HEARD_WHILE_QUIET` = `catch_up_started`,
  `catch_up_progress` (`EventBus.js:69-98`, `engineEvents.js:193`).
- **The "everything changed" event** is `GAME_RESET` (`engineEvents.js:44-53`), published after
  a new game or load (`EngineBootstrap.js:351`), a catch-up (`src/systems/core/CatchUp.js:385`),
  travel, and dev tools. `STATE_CHANGED` is retired but still published once by travel
  (`engineEvents.js:36-42`).

### 3.4 How engine state reaches React

The engine mutates `GameState.state` in place and announces it on the bus. The UI reads it five
ways:

1. **`useGameState(selector, events, filter, options)`** (`src/ui/hooks/useGameState.js:51-138`).
   The selector receives the `GameState` facade (its getters, `src/state/GameState.js:81-97`),
   not `state`. Listed events queue one microtask per burst (`useGameState.js:107-121`); the
   result is compared before `setState`, and unchanged parts keep their identity
   (`shareEqual`, `src/ui/hooks/structuralShare.js`). The selector contract (return primitives
   or flat projections) is at `useGameState.js:8-43`.
2. **`useTokenState` / `useTokenEvent`** (`src/ui/components/board/tokenEvents.js:82,110`): one
   Token's slice, woken only by events naming that Token.
3. **Direct `EventBus.subscribe` in components** (73 sites outside `ui/dev`), often writing the
   DOM without React: walking heroes and enemies get their `transform` written straight from
   `HEROES_WALKED` / `ENEMIES_WALKED` (`src/ui/components/board/MatHero.jsx:247-255`,
   `src/ui/components/board/MatToken.jsx:52-100`).
4. **Module stores read with `useSyncExternalStore`**: ~20 files keep a module-level `Set` of
   listeners (banners `src/systems/notifications/banners.js:24`, item stubs
   `src/systems/notifications/itemStubs.js:52`, drag hints, order and support highlights, fight
   panel, map mode, dev draw switches, …; grep `const listeners = new Set()`).
5. **Direct reads**: 42 UI files import `GameState` and read it imperatively (render-time reads,
   event handlers, polling intervals, §5.4).

**React contexts carry no game state**: `MatFitContext` (a number, `MatFitContext.jsx:18`), the
dnd contexts (`src/ui/dnd/DndKit.jsx:242-364`), and two camera/page contexts in `ui/components/atlas`.

**Re-renders per tick (measured, not re-run here).** `node bench/tick-commits.mjs`
(`bench/tick-commits.mjs`, `bench/README.md:748`) drives seeded ticks in the dev build and counts
React commits. Last recorded result, 2026-10-13, stress board S2: **0.57 commits and 3.89
component renders per tick**; a tick reaches React as one commit at most, and 48 % of ticks
commit nothing (`docs/reference/PERFORMANCE.md:827-872`). UI work merged since may have moved
these numbers: **unverified**, re-run in a bench window.

---

## 4. State and saves

### 4.1 The shape

`INITIAL_STATE` (`src/state/StateSchema.js:138-320`) has these top-level sections: `meta`,
`heroes` (hero shape owned by `HeroGenerator`/`HeroRehydration`), `inventory` (the Bank), `progress` (roster limit, Hall upgrade
ranks), `time` (`gameTimeMs`), `collection` (discoveries and counters), `ui` (New! badges, pinned
stubs), `board` (the active Region's mat, `createEmptyBoard`, `:52-88`), `quests`, `atlas`
(every Region; inactive ones hold a frozen board, `createRegionRecord`, `:94-132`), `world` (the
hex world, null before a world exists, `:315`). A board stores Tokens **by instance id at a mat
point** (`board.tokens`, `:56`), heroes' orders in `board.flags` (`:63`), floor loot in
`board.sprites`. Player settings are **not** in the save: they live in localStorage under
`fantasy_guild_settings` (`src/systems/core/SettingsManager.js:8`).

### 4.2 Slots and storage

- **3 slots** (`src/systems/core/SaveSlotHelper.js:8`).
- **Browser and dev builds**: localStorage keys `fantasy_guild_slot_<n>` and
  `fantasy_guild_slot_<n>_backup` (`SaveSlotHelper.js:4,15-26`); each save rolls the previous
  one into the backup first (`SaveManager.js:249-261`).
- **Desktop (Tauri) build**: one file per slot, `slot<n>.json` and `slot<n>.backup.json` in the
  app data folder's `saves/` (`src-tauri/src/saves.rs:33-40,120-124`), written whole via temp
  file and rename (`saves.rs:67-105`). The page talks to it through `invoke`
  (`src/systems/core/SaveFiles.js:20-36`); the backend is active only in a non-dev build with
  `window.__TAURI__` (`SaveFiles.js:39-43`).
- **When it saves**: autosave interval (`SaveManager.js:199-221`), `beforeunload` in the browser
  (`:210`), and in the desktop build a close handshake: the window asks the page to save, waits
  for the file, then closes (`SaveManager.js:158-176`, `saves.rs:200-216`).
- **Serialisation**: `GameState.serializeJson()` writes `{ version, savedAt, state }` with a
  `JSON.stringify` replacer, stripping each hero's runtime fields, without deep-copying first
  (`src/state/GameState.js:14,148-164`).

### 4.3 The load path

`EngineBootstrap.startSlot(slot)` (`EngineBootstrap.js:293-311`) → `SaveManager.loadSlot`
(`SaveManager.js:322-398`):

1. Read the slot (file or localStorage), parse; unreadable or invalid → one retry from the
   backup (`loadDamaged`, `:406-423`).
2. `migrateState` (`:353` → `src/systems/core/SaveMigration.js:24-123`). **Any save whose
   version is not exactly `GAME_VERSION` = `'0.8.1'` is refused** (`SaveMigration.js:28-30`,
   `StateSchema.js:40`); reworks break saves on purpose (`StateSchema.js:8-39`). For a current
   save it back-fills missing keys two levels deep from `INITIAL_STATE` (`:35-63`), converts
   old flags to orders, and drops retired fields (`currency`, `cartographer`, Vault/Tray board
   fields, retired upgrade ranks, old sprite names) (`:65-121`).
3. `validateSaveData` (`:359` → `StateSchema.js:345-399`).
4. `loadSavedState` (`:366` → `src/systems/core/LoadedState.js`): `GameState.initFromSave` only
   stores the save; the helper then rehydrates each hero and their equipment modifiers, assigns
   flag colours and back-fills `quests`, by static imports.
5. Bank normalised, shared gear copies reconciled, rate trackers cleared, autosave started, mat
   fitted to its current size (`SaveManager.js:369-382`), then `GAME_LOADED` (`:385`).
6. Back in `onSlotSelected`: `DiscoveryManager`, `AudioSystem`, `InventoryManager` init, the
   catch-up on load (§4.4), starter tools granted if missing, `GameLoop.start()`, then
   `GAME_RESET`, `HEROES_UPDATED`, `INVENTORY_UPDATED` (`EngineBootstrap.js:319-354`).

A new game: `SaveManager.newGame` (`SaveManager.js:518`) → `createDefaultGameData`
(`EngineBootstrap.js:235-266`: opening Bank, starter tools, Starter Camp Region, world, first
hero, modifier caches) → an immediate save (`:334`).

### 4.4 Catch-up after time away

`src/systems/core/CatchUp.js`. It plays missed time **through the real tick handlers**
(`GameLoop.runHandlers`, `CatchUp.js:343,358`) in 1,000 ms steps, at most 24 hours, in slices of
~50 ms of work with a yield between them so a progress bar can draw (`CATCH_UP` in
`src/config/loopConstants.js:29-44`; loop at `CatchUp.js:339-361`). While it runs: `GameClock`
runs from the save's `savedAt`, the bus is quiet, notifications are quiet, saving is suspended
(`enterQuiet`, `CatchUp.js:252-263`); at the end it saves once (unless `save: false`) and
publishes `CATCH_UP_FINISHED`, then `GAME_RESET` unless `reset: false` (`:374-388`). Two entry
points:

- **On load**: `EngineBootstrap.catchUpOnLoad` (`EngineBootstrap.js:216-227`) plays from the
  loaded `savedAt` with `reset: false` (`:222`; `onSlotSelected` publishes `GAME_RESET` itself
  once the loop has started). The untouched save is kept so the player can choose "Load as I
  left it" (`CatchUp.undoLast` → `SaveManager.restoreAndReload`, `CatchUp.js:77-82`,
  `SaveManager.js:440`).
- **Live gaps** (sleep, throttled background tab): the overflow from `TIME_OVERFLOW`
  (`CatchUp.js:96-117`). A gap of 2 minutes or more stops the loop and plays with the progress
  bar; a shorter one is played synchronously inside the tick that found it, in whole 1 s steps
  and without saving (`:113-116`); under a second waits for more.

The summary (items, level-ups, depletions, wounds, breaks, fights, news) is counted from engine
events while it plays (`CatchUp.js:29-46`).

### 4.5 Derived versus stored

| Derived at load or at runtime, never trusted from the save | Where |
|---|---|
| Hero `aggregator`, `className`, `traitName`, `level`, `_rev` (stripped on save) | `GameState.js:14`, `HeroRehydration.js:46-49` |
| Roster limit and Bank caps, from upgrade ranks | `GuildUpgradeManager.recompute` on `GAME_LOADED` (`src/systems/progression/GuildUpgradeManager.js:25,138`) |
| `quests.tutorialStep`, from `completedTutorials` | `QuestManager.js:80`, `QuestTokens.js:389` |
| Per-Token modifier caches ("tile aggregators") | `TileModifiers.rebuildAll` on `GAME_LOADED` and `BOARD_SWAPPED` (`BoardRunner.js:744-781`) |
| Which Token a hero's flag is working (only `workClaims` is saved) | `StateSchema.js:59-74,273-277` |
| Settings, dev tuners | localStorage, per device (§4.1, `src/ui/components/board/terrain/playmatTuning.js:494`, `src/config/matTuning.js:12`) |

Everything else in `GameState.state` is stored as is, including each inactive Region's whole
board.

---

## 5. Drawing

### 5.1 The mat

The mat is a **free playmat**: Tokens stand at points in mat units, no grid, no snapping
(`src/config/matGeometry.js:1-30`, `src/systems/board/MatPlacement.js` header). Its size is live
(12 × 6.5 steps of 160 u, 1920 × 1040 u by default; resizable by the dev Mat Tuner), so code
must call `matW()`/`matH()` rather than cache them (`matGeometry.js:16-30`).

`MatBoard.jsx` (`src/ui/components/board/MatBoard.jsx:62-…`, memoised) draws every Token
(`MatToken.jsx`), hero (`MatHero.jsx`) and flag (`FlagLayer.jsx`) as **positioned DOM elements**
keyed by instance id, in the z-layers set out in `matLayers.js` (`MAT_Z`: surface, ground,
ground fx, grid, Tokens, heroes, sky, rings, loot, work plate). One `pointermove` on the mat asks
the engine which Token is under the pointer (`MatBoard.jsx:62-75`). Other screens: the Guild
Hall's star web (`GuildHallBoard.jsx`, `HallSky.jsx`) and the Atlas with the hex world map
(`src/ui/components/atlas/`).

### 5.2 What moves and how

- **Walkers** (heroes, walking enemies) are moved by `transform: translate(…)` written straight
  to the element on each `HEROES_WALKED` / `ENEMIES_WALKED`, with a CSS
  `transition: transform 100ms linear` so a step glides for exactly one tick
  (`MatHero.jsx:226-255,288-300`; enemies `MatToken.jsx:52-100`, `walkerGlide.js`).
- **Frame clocks** (`src/ui/components/board/frameClock.js`): `onStep` (every 100 ms, all
  subscribers in one frame; the work bars, `workBar.js:57`), `onDue` (each subscriber at its own
  next time: hero and enemy sprite frames, ambient life at 8/s, loot bob, token fx, clock poses).
  `onFrame` (every frame) exists but **has no subscriber in game code** (grep, 2026-11-06).
- **One-shot animations** use the Web Animations API (`el.animate`, 19 sites: hit knocks
  `TokenHitArt.jsx:105`, fx, loot arcs, spawns) or framer-motion (9 files).
- **CSS infinite animations**: the gear-alert blink, drifting bits, the Hall sky's star and
  cloud drift (600 s, 300 s), the catch-up sheen (`src/tailwind.css:467,827,1110,1115`,
  `src/styles/components.css:96`).

### 5.3 Canvases

| Canvas | Redraws when | Where |
|---|---|---|
| Ground picture | Only when the Region's ground, a tuning slider or the fit changes (fit after 250 ms still); never per tick or frame. Built from a plan by `terrain/TerrainSurface.js` and a screen pass. Kept in the mat's own compositing layer on purpose (`willReadFrequently`, no transform). | `TerrainCanvas.jsx:13-40` |
| Ambient life (water, grass gusts, lava; clouds, leaves, birds) | `onDue` at 8 a second, small boxes only; off under reduced motion. | `AmbientLife.jsx:15-29,304` |
| Loot particles | `requestAnimationFrame` only while particles fly; sleeps after. | `ParticleOverlay.jsx:150-193` |
| World map picture | Painted in a Web Worker on a new world. | `atlas/worldPicture.worker.js`, `WorldMap.jsx:90-100` |
| Map previews, portraits, star outlines, hit-testing | On demand. | `atlas/mapPreview.js`, `dock/heroPortrait.js`, `StarOutline.jsx`, `ui/utils/alphaHitTest.js` |

The ground-picture pipeline lives in **`src/ui/components/board/terrain/`** (8 files, ~4,260 lines:
`TerrainGrass`, `TerrainLattice`, `TerrainBlend`, `TerrainPatches`, `TerrainShade`,
`TerrainProps`, `TerrainBands`, `TerrainSurface`, with their dev tuner `playmatTuning.js`): pure
picture-making with no game state. Its entry, `TerrainSurface.js`, is imported by three UI files
(`TerrainCanvas.jsx`, `groundSheets.js`, `atlas/mapPreview.js`), and `TerrainGrass.js` by two
more; it reads `config/registries/terrainRegistry.js` and three Region-shape helpers in
`systems/atlas`.

### 5.4 drawingPause: what stops when minimised

`installDrawingPause` (`src/ui/drawingPause.js:16-30`) pauses on `document.hidden` or the
desktop app's `fg-window-minimised` event (sent from `src-tauri/src/lib.rs:31-47`, because
WebView2 is never told it is minimised). It calls `setDrawingPaused`
(`frameClock.js`), which stops the three frame clocks (`onFrame`, `onStep`, `onDue`) and the
poll clock (`onPoll`). On resume each frame clock draws one frame, not the missed ones, and every
poller runs once at once, so the readouts are current.

**The poll clock** (`onPoll(fn, everyMs)`): one `setTimeout` for whichever poller is due soonest,
no animation frame; due times fall on a grid of each period (`Date.now()`), so pollers of one
period run together. On it: `FlagLayer`'s tooltip (500 ms), `HeroBubbleLayer` (500 ms, while a
moment or float is up), `IdlePlate` (250 ms), `PassiveProductionTooltip`, `TokenCard`'s clock
(1 s, card open), `WorkPlateLayer` (open plate), `MatCapBadge`'s open summary,
`FightPanelPopup`'s window check (1 s), `DockHeroFigure`'s status bubble (1 s, hovered),
`ItemStubColumn`'s pinned and open stubs (1 s), `SlotSelectionModal` (30 s). A test
(`PollClock.test.js`) refuses a new `setInterval` under `src/ui` outside dev tools and
`ArrowScrollList`'s held-arrow repeat (it runs only while a button is held, and stops on blur).
The Upkeep badge and summary poll nothing: they work out again on the events that can change what
they show (`UpkeepSummaryPanel.MAT_EVENTS`; the badge not on Bank changes, which cannot move its
total), and draw only when what they show changes.

Not paused by it (read from code; whether WebView2 throttles them when minimised is
**unverified**): the game tick (by design, `drawingPause.js:11-13`), CSS animations (§5.2),
Web Animations already running, and ParticleOverlay and camera glides (own rAF).
What reads `isDrawingPaused()`: the one-shot effect watchers (`matFx.watchMatFx`,
`fightFloats.watchFightFloats`, `TokenHitArt`'s hit, cycle-blink and echo handlers, `tokenFx.later`)
make nothing while paused, and `ParticleOverlay.spawnCollected` books no flight (the stub's count
shows at once). As a net under them, `playAt` and `playIn` (`fx/oneShot.js` `whenOver`) also take
an effect away by a timer a second after its end, since a hidden page never finishes an animation.

**Every frame, always**: nothing in a production build. In dev and perf-with-Debug builds the
`FPSCounter` runs its own `requestAnimationFrame` loop and a React commit each second, unless
the Perf HUD is showing (`src/ui/components/base/FPSCounter.jsx:10-25`,
`src/ui/ReactRoot.jsx:427-436`); keep that in mind when profiling a dev build.

### 5.5 Notification layers

- **Banners** (things that must not be missed) and **item stubs** (items gained and spent):
  module stores in `src/systems/notifications/` fed by `routing.js` (`:17-30` says where each
  event goes), drawn by `ui/components/notifications/BannerStack.jsx` and `ItemStubColumn.jsx`.
- **Callouts**: refusals at a mat point (`ui/components/board/CalloutLayer.jsx`) and screen
  callouts (`ui/components/notifications/ScreenCalloutLayer.jsx`).
- **`NotificationSystem`** messages are drawn only on the slot screen
  (`src/systems/core/NotificationSystem.js:4-11`).
- Level-ups stay on the hero (`routing.js:20-21`).

---

## 6. Content boundary

```
cms/ (separate app) ──Sync to Game──▶ data/*.json ──import.meta.glob (build time)──▶
src/config/DatabaseManager.js ──▶ src/config/registries/*.js ──▶ systems and UI
```

- **`data/`** holds `tokens.json`, `items.json`, `tokenRecipes.json`, `effects.json`,
  `starterCamp.json`, `skillPerks.json`, `hallStars.json`, `world.json`, `maps.json` and
  `palettes/` (`ls data`). Never hand-edit it (`CLAUDE.md`).
- **`DatabaseManager`** (`src/config/DatabaseManager.js:4-31`) globs eight of them eagerly at
  build time; there is no runtime fetch. **`data/maps.json` (`{}`) and `data/palettes/` are read
  by no game code** (`src/tests/MapBurstRetired.test.js:39` guards maps).
- **Registries** turn the JSON into lookups and run content migrations once at import: e.g.
  `tokenRegistry.js:42-63` expands effect-library references and rewrites renamed skill and
  effect ids through pure helpers in `src/systems/effects/`. That is why `config` imports a
  small kernel of `systems` (§7). Eight registries read `DatabaseManager`.
- **Audits**: `ContentAudit.reportContentIntegrity` runs at boot and `reportSaveContent` on every
  load, reporting only (`EngineBootstrap.js:149-153`).
- **Test fixtures** add Token types through `registerTokenTypes`, which nothing in `systems` or
  `ui` may call (`tokenRegistry.js:79-95`).

**The CMS** (`cms/`) is a separate local React app, the only authoring surface; its **Sync to
Game** overwrites `data/` and commits it on the checked-out branch. It imports 62 game modules
directly (mostly `src/config/registries`, `src/systems/progression/ledger/engine.js` and `plan.js`, `src/systems/effects`,
the content rules in `src/systems/core/*Rule.js`, and one UI file,
`src/ui/components/atlas/worldMapLayout.js`), so a game-side change can break it. Internals: see
[`cms/README.md`](../../cms/README.md).

---

## 7. Intended layering versus reality

**Intended** (the old header of `.dependency-cruiser.cjs`): utils < config < state < systems <
ui, lower never importing higher.

**Measured** (`npm run depcruise` JSON, folder-to-folder edges, 2026-11-06):

| Edge | Count | Verdict |
|---|---|---|
| systems → ui, state → ui, config → ui | 0 | holds |
| systems → React | 0 | holds |
| state → systems | 0 | holds |
| config → state | 0, not even transitively | holds |
| config → systems | 22 edges to 13 modules | **does not hold**: registries call pure helpers (`effects/*` migrations and statements, `atlas/TerrainMap`, `atlas/WaterShapes`, `core/wearRule`, `core/engineEvents`, `board/boardEvents`, `progression/hallStarText`, `hero/perkTable`) |
| utils → config | 2 | **does not hold**: `AssetManager` reads the sprite manifest |
| utils → systems | 0 | holds |
| i18n → anything but utils | 0 | holds |
| ui/components → ui/dev | 45 | production components import `ui/dev/perf/drawSwitches.js` (13) and `PerfProfiler.jsx` (2); `TestDashboard.jsx` imports every dev section |

**The real order** is: `utils` + `config` + a **pure kernel** of `systems` (the 13 modules above
and what they import: 18 `systems` modules plus `AssetManager` and `XPCurve`, none touching
`state`) at the bottom; then `state`; then the stateful `systems`; then `ui`. `utils` and
`config` are one layer in practice.

**Cycles.** `npm run cycles` (`tools/cycles.mjs`) finds **0 cycle groups**: the one group of 16
modules ran through dynamic imports in `GameState`, and rebuilding a loaded save now lives in
`src/systems/core/LoadedState.js`. depcruise lists **0 cycle paths**. There are **0 layer errors**.

**The rules now in `.dependency-cruiser.cjs`** (edited 2026-11-06 to match the above; every new
rule was shown to fire on a scratch fixture tree before being kept, and reports 0 on `src`):

| Rule | Severity | Today |
|---|---|---|
| `no-static-cycle`: a cycle made only of static imports | error | 0 |
| `no-circular`: any cycle, dynamic links included | warn | 0 |
| `systems-not-from-ui`, `systems-no-react`, `state-not-from-ui` | error | 0 |
| `state-never-imports-systems`: state imports nothing from systems | error | 0 |
| `game-not-from-cms`: nothing under `src/` but tests imports `cms/` | error | 0 |
| `config-not-from-state-or-ui` | error | 0 |
| `config-never-reaches-state` (transitively) | error | 0 |
| `config-systems-kernel-only`: config imports from systems only `CONFIG_KERNEL` | error | 0 |
| `i18n-leaf` | error | 0 |
| `utils-only-utils` (utils → systems, state, ui; utils → config allowed) | warn | 0 |
| `no-tests-from-src` | error | 0 |
| `no-orphans` | info | — |

Run: `npm run depcruise` → `x 24 dependency violations (0 errors, 24 warnings). 615 modules,
3748 dependencies cruised.`

Not encoded as a rule (a review decision, not a fact): whether production UI should import
`ui/dev/perf/*`.

---

## 8. Things that do not exist

Each checked by grep over non-test `src/` on 2026-11-06. "Residue" means the word survives in
names or comments only.

| Name in comments or docs | Reality |
|---|---|
| **Cards, decks, the Area Deck Loop** | Gone since the 0.6.0 playmat rework (`StateSchema.js:13-21`). Residue: `DeckDndProvider`/`DeckDndContext` (`src/ui/dnd/DndKit.jsx:242,392`); `collection.cardUseCounts` is **live** under an old name (completed cycles per Token type, `BoardRunner.js:392`). `TokenCard.jsx`, `EnemyCard.jsx`, `ArrivalCard.jsx` are UI panels, not cards. A card-era `data/effects.json` must not return (`DatabaseManager.js:13-14`). |
| **Tiles as a grid on the mat** | No mat grid: Tokens sit at points (`StateSchema.js:28-35,56`, `MatPlacement.js` header). Residue: `TileModifiers`, `TILE_CHANGED`, `TILE_EVENT_ALERT`, "tile aggregators"; the word "tile" appears on 437 non-test lines in 111 files. `FreeMatGuards.test.js` forbids a `tile` field in engine event payloads (`boardEvents.js:8-11`). |
| **"Tile" caveat** (`docs/archive/review_v3/code_review_v3_master_plan.md` §2.D) | Legitimate grids still exist: the **terrain cell lattice** under the ground picture (`src/ui/components/board/terrain/TerrainLattice.js`, 32 u cells; it no longer uses the word "tile" at all, 0 hits, against 122 in that review), sprite sheets (`sprite-manifest.js` has 0 "tile" hits now too), and **the hex world map** (`src/systems/world/hex.js`; "tile" is its art word, `WorldMap.jsx`, `worldPicture.js`). **§2.D is stale on the Guild Hall**: it is no longer a 7×7 board but a web of stars at unit coordinates around the Hall (`GuildHallBoard.jsx` `WEB_W`/`WEB_UNIT_PX`, `config/guildUpgrades.js`); no 7×7 Hall grid was found. |
| **Exploration** | No system. Only a retired skill id "Explore" in a comment (`src/systems/core/unknownRefRule.js:20`) and the word in `QuestManager.js:160`. |
| **Themes** | No theme system. `gameplay.themeMode` is a retired setting dropped on load (`SettingsManager.js:24`); a Token `theme` field is written by dev fixtures (`src/ui/dev/*Dev.js`) and one data entry; no `.theme` read was found in `src/` or `cms/src` (grep). |
| **Biomes** | **Live, not gone**: a Region records biome weights from the map kits it was written from (`StateSchema.js:107-109`, `src/systems/atlas/Budget.js:40-43`), world cells carry a kit biome (`src/systems/world/cellMat.js:107,306`). Residue only: `progress.discoveredTasksByBiome` is declared and never read (`StateSchema.js:219`). |
| **`quests.json`** | No such file and no loader. Quests are code (`src/systems/quests/tutorialQuests.js`, `questBounties.js`) and live as **Tokens on the mat** (`QuestTokens.js`, `QuestManager.js:25-30`). |
| **`data/maps.json`, Map bursts, the Cartographer** | `maps.json` is `{}` and read by nothing; Map bursts and purchase are retired, their save fields dropped (`SaveMigration.js:68-78`). |
| **Gold and currency** | Retired: no currency in the save (`StateSchema.js:204-207`, dropped in `SaveMigration.js:66`); collected coin sprites credit nothing (`SpriteLayer.js:397-401`). Residue: `OUTPUT_CURRENCIES` still lists `gold` and `ContentAudit` still validates `output.currency` (`config/registries/tokenConstants.js:88-95`, `ContentAudit.js:152-161`); no shipped data uses it (0 hits in `data/`). |
| **Token Vault, Tray** | Gone (no files); save fields dropped (`SaveMigration.js:85-98`, `StateSchema.js:80-83`). Residue in 13 files. |
| **Projects** | Retired, replaced by the Guild Hall upgrades (`StateSchema.js:210-214`). |
| **Areas, `areaStates`** | Gone (`StateSchema.js:18-21,389`). `config/areaBanners.js` is unrelated: Region banner pictures. |
| **The hero bench** | Gone since 0.4.0 (`StateSchema.js:14-17,153`). |
| **`EventBatch`** | Deleted (0 hits); batching now happens per hook in a microtask (§3.4). |
| **`registries/index.js` barrel** | Does not exist (`ls src/config/registries`), though `docs/reference/TESTING.md:134-135` names it. |
| **`inventory.slots.max/used`** | Inert, kept so old saves load (`StateSchema.js:176-183`). |

---

## 9. Measurement and tooling

| Tool | Command | What it answers | Where it is described |
|---|---|---|---|
| Engine bench | `npm run bench -- --compare` | Engine speed and the **work check** (exit 2 = the game did something different). Director only, in the owner's downtime. | `bench/README.md`, `docs/reference/TESTING.md:12-23` |
| Draw, drag, profile benches | `npm run bench:draw`, `bench:drag`, `bench:profile`, `bench:crisp` | Frame cost, drag cost, layers | `bench/README.md:351-…`, `docs/reference/PERFORMANCE.md` |
| React commits per tick | `node bench/tick-commits.mjs` | Commits and renders a tick sets off (dev build) | `bench/README.md:748-790` |
| Catch-up timing | (see README) | Offline-progress speed | `bench/README.md:308-334` |
| Perf HUD, stress boards | dev build, `?stress=<name>` | Live frame and render counts | `src/ui/dev/perf/`, `PERFORMANCE.md:24-44` |
| Tests | `npm test` | Unit and guard tests, seeded `Math.random` | `docs/reference/TESTING.md:3-50` |
| Import cycles | `npm run cycles` | Cycle groups, static versus dynamic | `tools/cycles.mjs` header; today 1 group, 0 static |
| Module graph and layer rules | `npm run depcruise` (`npm run depcruise:graph` needs Graphviz `dot`, not installed per knip, and writes into `docs/active/review/`, which does not exist yet) | §7 | `.dependency-cruiser.cjs` |
| Dead code | `npm run dead-code` (knip) | Unused files, exports, dependencies | `knip.json`; §2.1 for its blind spots |
| Copy-paste | `npm run duplication` (jscpd, `.jscpd.json`: `src`, 60 tokens, 5 lines) | Duplicated logic | `.jscpd.json` (not run for this document) |
| Reachability | `node tools/reachability.mjs` | Files unreachable from `main.jsx` | `docs/reference/TESTING.md:130-137` |
| Lint | `npm run lint` | ESLint | `eslint.config.js` |

**Lint count.** The director noted **581 errors** for `npm run lint` in the main checkout (2026-11-06). In a
clean worktree of the same commit it reports **79 problems (74 errors, 5 warnings)**: 64
`no-unused-vars`, 5 `react-hooks/rules-of-hooks`, 5 `react-hooks/exhaustive-deps`, 4
`no-useless-assignment`, 1 `no-constant-condition`, spread over `src/`, `src/tests/`,
`scripts/` and `docs/active/research/*/_tools/`. Likely cause of the difference (**unverified**):
`eslint.config.js:19-27` does not ignore `.claude/**` or `_art_leftovers/`, so the main folder
also lints the worktree checkouts under `.claude/worktrees/`.

---

## 10. Known gaps and stale docs noticed

For the doc audit; nothing below was edited.

1. `docs/archive/review_v3/code_review_v3_master_plan.md` §2.D: the Guild Hall is no longer 7×7
   (§8); `TerrainLattice.js` has 0 "tile" hits, not 122; the hex world map is a new legitimate
   grid it does not mention.
2. `docs/reference/TESTING.md:134-135`: "the CMS imports seven game modules" (it imports 62),
   and the `registries/index.js` barrel does not exist.
3. `src/state/StateSchema.js:322-333`: calls the game "the 7×7 playmat and the tutorial chain";
   `cards` "kept only because saves still carry it", yet every save is 0.8.1 and nothing reads
   it. `discoveredTasksByBiome` (`:219`) is never read.
4. `src/config/registries/tokenRegistry.js:36-40`: says the loader "mirrors itemRegistry's … then
   the folder glob"; it reads only `tokens.json`. `DatabaseManager.js:11` globs a `data/items/`
   folder that does not exist.
5. `cms/README.md` and `docs/reference/GDD.md` §11 say Sync writes `maps.json` ("maps included");
   the game reads no maps.
6. `src/systems/core/engineEvents.js`: `STATE_CHANGED` retired but still published by travel;
   six `ORPHAN_EVENTS` are subscribed with no publisher, four of them by `AudioSystem`.
7. `docs/reference/GDD.md` header: "Last checked against code: 2026-10-06".
8. `package.json` `depcruise:graph` writes to `docs/active/review/` (missing) with `dot` (not
   installed).
9. `knip.json` `$schema` points at knip 5; knip 6.44 is installed.
10. `src/main.jsx:2` "Optimized via Auditor Persona": noise.
11. Commits per tick (§3.4) were last measured 2026-10-13; `PERFORMANCE.md` itself was flagged
    out of date by the round-3 review (§2.E there), not re-checked here.
12. `src/ui/components/board/frameClock.js`: `onFrame` has no game callers (tests only), though
    the header presents it as one of the mat's three clocks.
