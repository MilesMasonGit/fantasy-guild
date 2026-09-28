# Fantasy Guild — the headless engine benchmark (Tier A)

`npm run bench` boots the real game engine in plain Node — no React, no browser,
no jsdom — builds a board, runs thousands of game ticks as fast as it can, and
reports how long each tick took. It answers "how much of a frame does one engine
tick steal?" (plan §2.A, §4.1 of `code_review_v3_master_plan.md`).

It does **not** measure drawing. Frame times, React commits and the browser's
layout/paint cost are Tier B (the in-game Perf HUD).

## Running it

| Command | What it does | Time |
|---|---|---|
| `npm run bench` | S1–S6, 3 timing runs each (S6 once), profile passes for S2–S5 | ~3 min |
| `npm run bench -- --only=S2,S3` | only some scenarios | |
| `npm run bench -- --compare` | also compare with `bench/baseline.json`; **exits 1** if any checked number is more than 20 % slower | |
| `npm run bench -- --save-baseline` | write this run's medians as `bench/baseline.json` | |
| `npm run bench -- --long` | S6 for the full 8 game-hours (288,000 ticks) | ~8 min more |
| `npm run bench -- --repeats=5` | more timing runs per scenario (the median is reported) | |
| `npm run bench -- --no-profile` | skip the profile passes | faster |
| `npm run bench -- --cpu-prof` | also write V8 `.cpuprofile` files to `bench/results/prof/` (open in Chrome DevTools → Performance) | |
| `npm run bench -- --inject-slow=0.5` | add a tick handler that busy-waits 0.5 ms — for proving `--compare` catches a slowdown | |
| `npm run bench:micro` | micro-benchmarks at 40 / 150 / 300 Tokens (Vitest `bench`, node environment) | ~15 s |

Results go to `bench/results/` (git-ignored) as JSON, tagged with the commit,
whether `src/`, `data/` or `bench/` had uncommitted changes, the Node version,
the machine name and CPU.

### Reading the table

- **p50** is the typical tick, **p99** the one-in-a-hundred slow tick (ten times
  a second, that is one every 10 s), **max** the worst seen.
- **same work** — each scenario is run several times with the same seed; "yes"
  means every run ended in exactly the same state (Tokens, charges, Bank, hero
  XP, loot). "NO" means the runs did different work and their times are not
  comparable — investigate before trusting the numbers.
- **heap Δ** is the heap after a forced garbage collection, after the measured
  ticks minus before. S6's checkpoints show the trend over game time.
- The **profile** lines come from a separate run with probes switched on (see
  below), so its milliseconds are a little inflated; use them for "where does
  the time go", never for "how long is a tick".

### `--compare` and the baseline

`--compare` checks, per scenario, **p50 and p99** of the tick (S1–S3, S5, S6)
and the **worst single arrival/drop** and **the shrink** (S4). A number fails
when it is more than **×1.2** the baseline **and** more than **0.02 ms** worse
(the floor stops sub-microsecond timer noise on S1 from failing a run).

⚠ Timing is noisy: another program using the CPU moves these numbers. Take the
baseline on a quiet machine, and when a compare fails, run it again before
believing it. `bench/baseline.json` records the machine it was taken on; a
baseline from one machine means nothing on another.

## The scenarios

| Id | Name | Board | Ticks (warm-up + measured) |
|---|---|---|---|
| S1 | Quiet Hall | Hall, 1 hero, 5 Tokens (4 producers, 1 mill) — the floor | 2,000 + 5,000 |
| S2 | Realistic late game | 11-step mat. Hall + 39 placed (the default cap is 40): 20 producers, 3 fed mills, 3 unfeedable smelters, 3 passives, 2 nearby buffs, 3 Forests + 3 Quarries (60 spawned trees/rocks), 2 goblin camps (6 hostile goblins walking about). 8 heroes with flags, walking; one pinned to a smelter that runs dry (a stalled station with a hero on it). Quest Tokens from the Hall. Loot drops every cycle, auto-collect on. ~108 Tokens. | 1,000 + 3,000 |
| S3 | Torture | 20-step mat. 200 placed incl. Hall and **one board-reach aura**, 5 Forests + 5 Quarries (100 spawned), 4 war camps (20 goblins), 8 heroes. ~320 Tokens. | 300 + 500 |
| S4 | Push storm | 20-step mat, 60 placed + a Forest packed round with 24 trees. 50 **arrivals** at the Forest (`EffectActions.spawn`, which pushes), 50 **player drops** there (`Placement.placeTokenAt`, which nudges or refuses), then the mat **shrunk 20 → 6**. Each operation timed on its own. | — |
| S5 | Rebuild storm | S2 plus one board-reach aura | 500 + 1,500 |
| S6 | Long idle | S2, 30 game-minutes with a checkpoint every 5 (`--long`: 8 game-hours, every 30) — heap after GC and the size of every runtime structure the bench can see | 1,000 + 18,000 |

Every spawner is filled to its cap before the heroes arrive (`prefillSpawners`,
through the real `SpawnerSystem.attemptSpawn`), so the warm-up warms the JIT
rather than waiting for the board to fill.

## How it works

- `run.mjs` — the command. Runs each scenario in a **fresh Node process**
  (`worker.mjs`), a few times, takes medians, prints the table, writes JSON,
  compares.
- `worker.mjs` — one run. The engine uses Vite-only features
  (`import.meta.glob` in `DatabaseManager.js`), so plain Node cannot import it.
  The worker starts a Vite server in middleware mode (no HTTP, no watcher) and
  loads everything through Vite's SSR module loader — the same transform Vitest
  uses, in the plain Node environment. Started with `--expose-gc`.
- `lib/prelude.mjs` — the process boundary, loaded before any engine code:
  - **seeded `Math.random`** (mulberry32, reseeded per scenario — CR3-044), so
    two runs do the same work;
  - a **virtual wall clock**: `Date.now()` advances 100 ms per tick, as it does
    in the game, so loot absorption, effect expiry and the rate windows behave
    as they would in play (`performance.now()` is untouched — it is the timer);
  - in-memory `localStorage` (empty, so every setting is its default), and
    silent `Audio`, `Image` and `document` stand-ins.
- `lib/harness.mjs` — boots the engine as `main.jsx` → `EngineBootstrap.init()`
  → `onSlotSelected(new game)` do, minus React, the art preloader, autosave,
  `createDefaultGameData` (content Tokens) and the wall-clock `setInterval`.
  All 9 tick handlers are registered (it checks). Ticks are driven with
  `GameLoop.runHandlers(100)`, the entry point `DevTools.advanceTime` uses. The
  logger runs as in a production build (prints nothing) and its calls are
  counted.
- `lib/instrument-plugin.mjs` — **profile pass only.** ES-module exports cannot
  be patched from outside, so a Vite plugin rewrites a short named list of
  function declarations as they are loaded into the bench process (the files on
  disk are untouched): the original is renamed and a wrapper counts and times
  it. If a named function is ever renamed or duplicated in the game, the plugin
  fails loudly instead of reporting a silent zero. The profile pass also wraps
  each `GameLoop.tickHandlers` entry and `EventBus.publish` (events per tick by
  name, and the subscribers each one reached).
- `fixtures.mjs` and `scenarios/` — see below.
- `micro/` — `npm run bench:micro`: `BoardState.tokens()`, `nearby.tokensWithin`,
  the push solver via `MatPlacement.forceSpot`, Flags choosing (a re-plant, which
  releases and chooses) and `TileModifiers.rebuildAll` with and without a
  board-reach aura, each at 40, 150 and 300 Tokens.

### How fixtures are registered

A fresh game has no workable Token and a roster of 0, by design. So the bench
**never touches `data/*.json`**: `fixtures.mjs` imports the test suite's own
fixture Tokens (`src/tests/fixtures/testTokens.js` — stable instruments with
fixed numbers) and registers a handful more with `registerTokenTypes`, all in
memory, in the bench process only, prefixed `bench_`:

- `bench_hall` — an inert 2×2 with `isGuildHall` (the shipped Hall carries
  authored content that would move the bench whenever it is retuned);
- `bench_tree` / `bench_rock` — spawned logging / mining Tokens with 40 charges,
  so they run out and their spawners refill them;
- `bench_forest`, `bench_quarry`, `bench_camp`, `bench_warcamp` — spawners;
- `bench_goblin` — a hostile level-1 melee enemy with one charge;
- `bench_mill` (fed by the producers) and `bench_smelter` (needs coal, which
  nothing makes: the stalled station);
- `bench_board_aura` — one `provides` rule with `reach: 'board'`.

Heroes are made with `generateHero`, given fixed ids (`hero_bench_0` …) and
fixed skills, and added with `HeroManager.addHero` after raising the roster
limit. Flags are planted with `Flags.plant`, as the player's drop does.

⚠ If a scenario's numbers move after a fixture edit, the fixture is the
suspect, not the engine. Keep them boring.

## What it cannot measure

- **Drawing.** No React, no DOM, no layout, paint or compositing — that is where
  the 6.06 ms frame budget is mostly spent (plan §2.A). Tier B measures it.
- **React work a tick triggers.** Events are counted, but the UI's listeners are
  not subscribed here, so "listener calls" counts engine subscribers only (a
  `board:tile_event_alert` with no engine listener still costs the UI in game).
- **The browser's JIT and GC.** Node's V8 is close to Chromium's, not identical.
- **Wall-clock behaviour.** Ticks are fed a fixed 100 ms; the clamp and the time
  bank's overflow path in `GameLoop.tick()` are not exercised. `setTimeout`
  work does not run inside the tick loop (see below).
- **Two deliberate differences from the browser**, both in `prelude.mjs`:
  `window` is not defined, so SpriteLayer skips its 1.1 s absorb `setTimeout`
  (the tick absorbs on the virtual clock instead) and AudioSystem skips its
  autoplay-unlock listeners.
- **Hot functions called inside their own module** are counted only because the
  profile pass rewrites the declaration; a function not on the probe list is
  not counted. Push-solver *pair checks* are not counted (they are inside
  `relax`'s loop); `relax` calls and time are.
- **Heap growth that only shows after hours.** The default S6 is 30 game-minutes;
  certify with `--long`.
- **Anything the fixtures don't exercise** — shipped content with unusual
  rules (triggers, `Cannot`, statuses, promotions) is not on these boards.
