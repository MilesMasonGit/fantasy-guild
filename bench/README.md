# Fantasy Guild — the headless engine benchmark (Tier A)

`npm run bench` boots the real game engine in plain Node — no React, no browser,
no jsdom — builds a board, runs thousands of game ticks as fast as it can, and
reports how long each tick took. It answers "how much of a frame does one engine
tick steal?" (plan §2.A, §4.1 of `docs/archive/review_v3/code_review_v3_master_plan.md`).

It does **not** measure drawing. Frame times, React commits and the browser's
layout/paint cost are Tier B (the in-game Perf HUD). `npm run bench:draw` and
`npm run bench:drag` measure those in a real browser: see
[Drawing and drag benches](#drawing-and-drag-benches) at the end.

## Running it

| Command | What it does | Time |
|---|---|---|
| `npm run bench` | S1–S8, 3 timing runs each (S6 and S8F once), profile passes for S2–S5 and S7 | ~5 min |
| `npm run bench -- --only=S2,S3` | only some scenarios | |
| `npm run bench -- --compare` | also compare with `bench/baseline.json`: **exits 2** (WORK CHANGED) if any scenario did different work, **exits 1** if any checked number is more than 20 % slower — see below | |
| `npm run bench -- --accept-work-change=CR3-123` | compare, but let a deliberate, ruled change of work through: rewrites only the fingerprints in `bench/baseline.json` and records the ticket (implies `--compare`) | |
| `npm run bench -- --save-baseline` | write this run's medians and fingerprints as `bench/baseline.json` | |
| `npm run bench -- --long` | S6 for the full 8 game-hours (288,000 ticks) | ~8 min more |
| `npm run bench -- --repeats=5` | more timing runs per scenario (the median is reported) | |
| `npm run bench -- --no-profile` | skip the profile passes | faster |
| `npm run bench -- --cpu-prof` | also write V8 `.cpuprofile` files to `bench/results/prof/` (open in Chrome DevTools → Performance). ⚠️ On Node 24 the file written is the module-loader thread's idle profile, not the engine's (both threads get the same fixed name; checked 2026-10-08). Until fixed, profile with `node --cpu-prof --cpu-prof-dir=<dir>` and no name, and read the `.0.` file (see Catch-up timing below) | |
| `npm run bench -- --inject-slow=0.5` | add a tick handler that busy-waits 0.5 ms — for proving `--compare` catches a slowdown | |
| `npm run bench:micro` | micro-benchmarks at 40 / 150 / 300 Tokens (Vitest `bench`, node environment) | ~15 s |

Results go to `bench/results/` (git-ignored) as JSON, tagged with the commit,
whether `src/`, `data/` or `bench/` had uncommitted changes, the Node version,
the machine name and CPU.

### Reading the table

- **p50** is the typical tick, **p99** the one-in-a-hundred slow tick (ten times
  a second, that is one every 10 s), **max** the worst seen.
- **same work** — each scenario is run several times with the same seed; "yes"
  means every run ended with exactly the same fingerprint (below). "NO" means
  the runs did different work and their times are not comparable — investigate
  before trusting the numbers. (`--compare` then fails with exit 2.)
- **heap Δ** is the heap after a forced garbage collection, after the measured
  ticks minus before. S6's checkpoints show the trend over game time.
- The **profile** lines come from a separate run with probes switched on (see
  below), so its milliseconds are a little inflated; use them for "where does
  the time go", never for "how long is a tick".

### `--compare` and the baseline

`--compare` checks two separate things against `bench/baseline.json`, and says
which one failed by its exit code:

| Exit | Means | What to do |
|---|---|---|
| **0** | same work, no timing regression | merge-ready (as far as the bench goes) |
| **1** | **REGRESSED** — slower, same work | run it again before believing it (timing is noisy), then find the slowdown |
| **2** | **WORK CHANGED** — the engine did different work from the baseline | a speed fix must not do this: find out why. A deliberate, ruled change: `--accept-work-change=<ticket>` |
| **3** | the bench itself failed (a worker crashed, a bad option, no baseline) | read the error |

Exit 2 wins over 1: when the work changed, the timings measure different work.
The merge rule for a speed fix is: the test baseline unchanged, **and**
`npm run bench -- --compare` exits 0.

#### The work: identical results as a gate (CR3-550)

Every timing run ends by taking a **fingerprint** of what the engine did
(`lib/fingerprint.mjs`), and the baseline stores each scenario's fingerprint
beside its timings. `--compare` prints `same` or `WORK CHANGED` per scenario,
names every field that differs and shows both values. The fingerprint is:

- readable totals: Tokens on the mat, charges left, Bank items, hero XP, loot
  sprites, game time;
- `tokensHash` — every Token's id, type, **exact** `x`,`y`, charges, arrival
  order and cycle progress, in arrival order;
- `bankHash` (every item and quantity), `heroHash` (each hero's status, HP,
  energy, skills and XP, statuses, equipment, flag, claimed Token and walking
  body), `spriteHash` (every loot sprite, exact point included), `binHash`;
- **`randomDraws`** — how many numbers the seeded `Math.random` handed out
  (`lib/prelude.mjs`). The most sensitive single number: a change that consumes
  randomness in a different order changes it even when the end state happens
  to match;
- **S4 only**: the position hash after the arrivals, after the landing drops
  and after the shrink, the measured rim radius, and every count (arrivals
  landed, drops refused, landing drops placed / nudged / refused).

Totals alone are too weak — moving a Token or giving a buff to a different
Token can keep every total identical. The hashes are not.

What changes the work, and what does not:

- `--seed` changes every scenario's work, and `--long` S6's. A run with other
  values than the baseline's prints `not checked` for those scenarios instead
  of failing.
- `--repeats`, `--inject-slow`, `--no-profile` and `--cpu-prof` change only the
  time (proved: `--inject-slow` exits 1, never 2).
- A different **Node version** can change the work for reasons outside the
  code (it prints a warning and still fails). Re-take the baseline on a Node
  upgrade.
- Fingerprints come from the timing runs. The profile pass is not checked.

**`--accept-work-change=<ticket>`** is for a change of behaviour someone ruled
on (a ticket, an owner decision). It still runs the whole compare, but a
`WORK CHANGED` scenario is let through: its new fingerprint is written into
`bench/baseline.json` (the timing numbers are left alone), the ticket, commit
and changed fields are appended to `meta.workChanges` there, and the results
JSON records it as `acceptedWorkChange`. Commit the baseline with the change.
A run whose repeats disagree (not deterministic) is never accepted. Don't use
it to make a speed fix pass: a speed fix that changes the work is not identical.

#### The timings

`--compare` checks, per scenario, **p50 and p99** of the tick (S1–S3, S5–S7),
for S4 the **worst arrival**, the **p50 landing drop**, the **worst
refused drop** and **the shrink**, each on its own, and for S8 the **wall time
of the catch-up hour**. A number fails when it is
more than **×1.2** the baseline **and** more than **0.02 ms** worse (the floor
stops sub-microsecond timer noise on S1 from failing a run). The landing drops
are checked on their p50 because the worst of fifty ~3 ms drops is whichever
one a GC pause hit: it moved 4.5–8.4 ms between runs on a quiet machine, while
the p50 stayed within 3.10–3.41 ms. Their worst is still printed.

⚠ Timing is noisy: another program using the CPU moves these numbers. Take the
baseline on a quiet machine, and when a compare fails, run it again before
believing it. Even quiet, a p99 or a worst-of-50 can land just over ×1.2 on
one run in three or so; a real regression fails every run. The work check is
not affected by load at all.

`bench/baseline.json` records the machine it was taken on; a baseline's
timings from one machine mean nothing on another.

## The scenarios

| Id | Name | Board | Ticks (warm-up + measured) |
|---|---|---|---|
| S1 | Quiet Hall | Hall, 1 hero, 5 Tokens (4 producers, 1 mill) — the floor | 2,000 + 5,000 |
| S2 | Realistic late game | 11-step mat, Token cap lifted (the board is over the game cap of 80). Hall + 39 placed: 20 producers, 3 fed mills, 3 unfeedable smelters, 3 passives, 2 nearby buffs, 3 Forests + 3 Quarries (60 spawned trees/rocks), 2 goblin camps (6 hostile goblins walking about). 8 heroes with flags, walking; one pinned to a smelter that runs dry (a stalled station with a hero on it). Quest Tokens from the Hall. Loot drops every cycle, auto-collect on. ~108 Tokens. | 1,000 + 3,000 |
| S3 | Torture | 20-step mat. 200 placed incl. Hall and **one board-reach aura**, 5 Forests + 5 Quarries (100 spawned), 4 war camps (20 goblins), 8 heroes. ~320 Tokens. | 300 + 500 |
| S4 | Push storm | 20-step mat, 60 placed + a Forest packed round with 24 trees. 50 **arrivals** at the Forest (`EffectActions.spawn`, which pushes); 50 **refused player drops** in the cluster's middle (`Placement.placeTokenAt` — every one flies back, **by design**: FP-46, a drop never pushes); 50 **landing player drops** aimed round the cluster's rim (the radius is measured: the farthest tree from the Forest; angles i × 2π/50), each landing with a nudge, then taken off again; then the mat **shrunk 20 → 6**. Each operation timed on its own (CR3-156). | — |
| S5 | Rebuild storm | S2 plus one board-reach aura | 500 + 1,500 |
| S6 | Long idle | S2, 30 game-minutes with a checkpoint every 5 (`--long`: 8 game-hours, every 30) — heap after GC and the size of every runtime structure the bench can see | 1,000 + 18,000 |
| S7 | Waiting for room | 8-step mat packed with placed passives until not even a tree fits within 800 u of the two waiters: a **Forest under its cap with nowhere to spawn**, and a **Foundation building a 2×2 station with no room to stand**, a builder pinned to it. Both re-run their placement search every tick (CR3-201). Its own types and recipe are registered inside the scenario, so no other scenario's work changes. Added to `baseline.json` on its own (`meta.addedScenarios`). | 300 + 1,500 |
| S8 | Catch-up hour | S2, warmed up as S2 is (1,000 ticks), **saved and loaded** as a player's slot is, then one game-hour of the game's own catch-up (`CatchUp.run`): 1000 ms steps, the game clock, the bus quiet, toasts and sounds off, slices with yields. The virtual wall clock stands still through it, as the real one nearly does. | 1,000 + 3,600 steps |
| S8L | Same hour, plain 1000 ms steps | The same save and load, then 3,600 × `GameLoop.runHandlers(1000)` with the virtual clock moving, as live play's would. The reference S8 must equal. | 1,000 + 3,600 steps |
| S8F | Same hour, 100 ms ticks | The same save and load, then 36,000 ticks of 100 ms: the fidelity reference. Run once. | 1,000 + 36,000 |

Every spawner is filled to its cap before the heroes arrive (`prefillSpawners`,
through the real `SpawnerSystem.attemptSpawn`), so the warm-up warms the JIT
rather than waiting for the board to fill.

### The catch-up gates (S8, S8L, S8F)

Two checks between this run's own S8 rows, printed as "Catch-up gates", independent of the
baseline. Either failing exits **2** (WORK CHANGED), and `--accept-work-change` never lets it
through (the baseline is then left alone).

- **Identity**: S8 must end **exactly** as S8L: every fingerprint field, random draws included.
  It proves the catch-up mode itself (the quiet bus, the game clock, the silenced sounds and
  toasts, the slices, saving suspended) changes nothing about the game. Their fingerprints leave
  the wall-clock time out of ids (`fingerprint({ stableIds: true })`): a Token or loot id carries
  the real time it was made at, which differs by design; the rest of each id stays.
- **Fidelity**: what the hour produced in S8L (Bank items, hero XP, work cycles, Tokens depleted)
  must be within **±1 %** of S8F's 100 ms ticks, or within one for a count too small to judge
  in percent (about 6 depletions an hour). 1000 ms steps can never equal 100 ms ticks exactly
  (fewer random draws), so this is a tolerance, not a fingerprint.

Proven to bite (2026-10-08): a catch-up that skipped the game clock left 40 loot stacks on the
floor and 68 fewer items in the Bank than S8L (identity failed, exit 2); without the work
cycle's carried leftover, S8L made 4.59 % fewer Bank items and 4.10 % fewer cycles than S8F
(fidelity failed, exit 2). Measured: identical (all four within 0.00 %).

S8, S8L and S8F were added to `baseline.json` under T-080 (`meta.workChanges`, no fields: new
scenarios). Only S8 carries a timing.

## How it works

- `run.mjs` — the command. Runs each scenario in a **fresh Node process**
  (`worker.mjs`), a few times, takes medians, prints the table, writes JSON,
  compares (work first, then timings) and sets the exit code.
- `lib/fingerprint.mjs` — the work fingerprint (CR3-550): stable FNV-1a hashes
  of the end state, read through the same engine modules the run used.
- `worker.mjs` — one run. The engine uses Vite-only features
  (`import.meta.glob` in `DatabaseManager.js`), so plain Node cannot import it.
  The worker starts a Vite server in middleware mode (no HTTP, no watcher) and
  loads everything through Vite's SSR module loader — the same transform Vitest
  uses, in the plain Node environment. Started with `--expose-gc`.
- `lib/prelude.mjs` — the process boundary, loaded before any engine code:
  - **seeded `Math.random`** (mulberry32, reseeded per scenario — CR3-044), so
    two runs do the same work; it counts its draws for the fingerprint;
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
  `board:tile_event_alert` with no engine listener still costs the UI in game: the callout layer hears it).
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

## Catch-up timing (offline progress)

Two scripts in `bench/catchup/` time a long run of game time, for offline progress
(brief 40; the numbers and the plan are in `docs/active/concept_offline_progress.md`,
"Catch-up plan"). Neither is part of `npm run bench` or its `--compare` (S8 is: above).

| Command | What | Time |
|---|---|---|
| `node --expose-gc bench/catchup/time.mjs` | S2 headless for 1, 6 and 24 game-hours at 1000 ms steps: wall time, ms per step and the readable fingerprint totals at each checkpoint | ~1 min |
| `… time.mjs --step=100 --hours=1,6` | today's tick, or any step (`--out=run.json` keeps the full fingerprints) | 24 h at 100 ms: ~4 min |
| `node --expose-gc --cpu-prof --cpu-prof-dir=<dir> bench/catchup/time.mjs --hours=6` | a V8 profile of the engine (the `.0.` file; the other is the module loader's thread) | |
| `node bench/catchup/page.mjs` | the same in the **real page**: perf build, headless Chrome, S2 with the whole UI listening, 1 game-hour at 1000 ms, alternating `ui` and `muted` × 3 | ~4 min |
| `… page.mjs --hours=24 --modes=muted,ui --no-build` | a full 24 h in the page | ~2 min |
| `… page.mjs --hours=24 --modes=catchup,catchup` | **the 30 s target**: the game's own catch-up (`CatchUp.run`, slices and yields included) for 24 h, twice | ~2 min |

- ⚠️ The headless numbers are about **twice** the page's for the same board (Vite's SSR
  loader turns every imported call into a property lookup; the shipped build is bundled).
  Judge "under 30 s" with `page.mjs`; use `time.mjs` for comparisons and fingerprints.
- `muted` in `page.mjs` is the bus gone quiet (`EventBus.setQuiet`), as a catch-up runs it:
  every listener tagged `UI_LISTENER` is skipped and the engine's own still run.
- `catchup` runs `CatchUp.run` itself: no virtual clock (the game clock does that job), the
  bus quiet, toasts and sounds off, 50 ms slices with a yield between them. Measured
  2026-10-08: 24 h in 23.9 s.
- `time.mjs` and the `ui` / `muted` modes put a virtual wall clock in place (Date.now() moves
  with game time), as the bench does.

## Drawing and drag benches

Two commands drive the real game in the installed **Chrome, headless**, over the
DevTools protocol (`bench/browser/cdp.mjs`, no packages: Node 24's built-in
`WebSocket`). Chrome gets its own throwaway profile, the **real GPU** (the
graphics process was the S2 bottleneck in round 3, so software rendering would
measure something else), and background throttling off. Chrome, the profile and
any server the bench started are removed on every way out, Ctrl+C included.

Both serve the game themselves on a free port (never 5173/5174): the **perf
build** by default (`vite build --mode perf` → `dist-perf/`, served by Vite's
preview), or the **dev build** (a Vite dev server with its own dependency cache,
`node_modules/.vite-bench`, so it never fights the owner's server).

⚠️ **Drawing numbers are machine-specific.** `bench/draw-baseline.json` is the
owner's PC, taken on a quiet machine. A number from another machine, or from a
busy one, compares with nothing.

### `npm run bench:draw`: what drawing costs

For each scene: a fresh tab at **1600 × 1000, DPR 1**, the CPU slowdown set
(`Emulation.setCPUThrottlingRate`), the stress board loaded (`?stress=…`),
**20 s settle**, `__perf.reset()`, a **20 s window**, then `__perf.report()`.

| Scene | What |
|---|---|
| `S1` `S2` `S3` | the quiet, realistic and torture stress boards |
| `bank` | S2 with the Bank drawer open (a real click on the Item Bank button) |
| `shop` | S2 with the Shop drawer open (a real click on the Shop button) |
| `inspect` | S2 with the hero inspection sheet open (a real click on a dock hero) |
| `notify` | S2 with 20 notifications every 4 s (`NotificationSystem.info`, from a page timer) |
| `loot` | S2 with 30 loot sprites every 3 s (`SpriteLayer.addSprite`, as the QA panel's Scatter Loot does) |

Columns: **fps** (frames ÷ window), **frame interval** p50/p95/p99, **frame
work** p50/p99 (rAF start to the first task after the frame: the main thread's
cost of a frame), **≤6.06 %** (frames whose work fits a 165 Hz frame), **LoAF**
(long animation frames: count / worst ms), **engine tick** p50/p99, **Mat own/s**
(MatBoard's own renders), **mat sub/s** and **dock/s** (React commits in the mat
and dock subtrees), **DOM** nodes and JS **heap**.

| Command | What it does | Time |
|---|---|---|
| `npm run bench:draw` | perf build, CPU 1× and 4×, all 8 scenes | ~12 min |
| `npm run bench:draw -- --quick` | S2 only, 6 s settle, 8 s window (agent checks; not comparable with full runs) | ~1 min |
| `npm run bench:draw -- --dev` | also the dev build (doubles the time) | |
| `npm run bench:draw -- --only=S2,bank` | some scenes | |
| `npm run bench:draw -- --cpu=1` | CPU slowdowns to run (default `1,4`) | |
| `npm run bench:draw -- --switches` | the **cost table** (below); perf, 1× unless `--cpu` is given | ~12 min |
| `npm run bench:draw -- --repeats=3` | windows per scene; the median is reported with its min–max spread | |
| `npm run bench:draw -- --compare` | compare with `bench/draw-baseline.json` (2 windows per scene unless `--repeats`) | about twice the default |
| `npm run bench:draw -- --save-baseline` | write the medians as `bench/draw-baseline.json` (3 windows per scene unless `--repeats`) | about three times the default |
| `npm run bench:draw -- --ab=http://localhost:5391` | interleaved A/B per scene: A (this checkout's build) and B (a server someone else started), in the order A, B, B, A | |
| `npm run bench:draw -- --no-build` | reuse `dist-perf/` as it is | saves ~20 s |
| `--settle=20 --window=20` | seconds | |

Results go to `bench/results/draw/` (git-ignored) as JSON, tagged with the
commit, which of `src/` `data/` `bench/` `public/` had uncommitted changes, the
machine, CPU, Chrome version and the GPU / ANGLE backend Chrome reports.

| Exit | Means |
|---|---|
| 0 | fine (and, with `--compare`, no regression) |
| 1 | **REGRESSED**: a number is worse than the baseline beyond the tolerance |
| 3 | the bench failed: a scene drew nothing or was hidden, a page reloaded mid-run, a click opened nothing, there is no baseline, or the baseline used another settle or window |

**The cost table** (`--switches`): S2 with everything drawn, then once with each
of the 17 drawing switches off (`?off=<name>`, `src/ui/dev/perf/drawSwitches.js`).
All-on is measured at the start, the middle and the end; its spread is the
**noise**, and a system's cost is all-on minus switch-off. A cost inside the
noise is printed but marked "above noise: no".

**A/B** (`--ab=<url>`): for comparing two branches. The director starts the
second branch's server (its own worktree, port and Vite `cacheDir`); this
checkout's build is A. Only the A/B difference within one run means anything.

#### Noise and the tolerance

Measured on the owner's PC (i7-8700, RTX 3060, Chrome 154) on 2026-10-07 with
the machine **under load** (other agents running; about 12 % CPU with the bench
idle), S2, perf build:

| | windows | fps | frame work p50 | frame work p99 | ≤6.06 % |
|---|---|---|---|---|---|
| CPU 1×, 10 s settle | 5 | 162.3–163.6 | 2.00–2.11 ms | 8.0–8.7 ms | 96.8–98.0 |
| CPU 1×, 25 s settle | 3 | 164.0–164.0 | 1.81–1.91 ms | | |
| CPU 4×, 10 s settle | 5 | 52.8–62.4 | 17.1–20.6 ms | 71.4–77.3 ms | 0.1–0.6 |
| CPU 4×, 20 s settle | 5 | 67.7–82.2 | 13.4–16.2 ms | | |

What that showed, and what was done about it:

- **The board is still settling for its first ~20 s** (heroes walking to their
  jobs): a 10 s settle read ~10 % more frame work than a 25 s one, and at 4× the
  fps jumped by a third. The settle is therefore **20 s**, and `--compare`
  refuses a baseline taken with another settle or window.
- **At 1× fps is pinned at ~164** (headless Chrome draws at about 164 Hz, the
  6.10 ms interval), so fps only moves once frames get expensive. **Frame work**
  is the sensitive number there.
- **At 4× the spread is several times wider.** Chrome's CPU throttle stretches
  everything the renderer does, including time lost to other programs, so other
  load is magnified. Hence a separate, wider tolerance.

`--compare` fails a number only when it is worse by more than **both** a ratio
and a floor (`TOLERANCE` in `bench/browser/drawLib.mjs`):

| | fps | frame work p50 | frame work p99 | ≤6.06 % |
|---|---|---|---|---|
| CPU 1× | −5 % and −3 fps | +20 % and +0.3 ms | +30 % and +2 ms | −5 % and −4 points |
| CPU slowed | −25 % and −5 fps | +35 % and +2 ms | +50 % and +10 ms | −25 % and −5 points |

The 1× set is about three times the measured spread; the 4× set about one and a
half times the spread measured under load, which should be tighter on a quiet
machine: re-check it when the baseline is taken. As with the engine bench, when
a compare fails, run it again before believing it.

#### What it cannot measure

- **React commits in the perf build.** React's production build never calls a
  `<Profiler>`'s `onRender`, so `mat sub/s` and `dock/s` are blank (`—`) for the
  perf build. `Mat own/s` works in both. Use `--dev` for commit counts.
- **The real window.** Headless Chrome is not the desktop app's WebView2, and
  its frame clock is not the owner's 165 Hz screen. The numbers are for
  comparing with each other, not for "is it smooth on my screen".
- **The GPU's own time.** The Perf HUD measures the main thread. Round 3's
  "GPU busy" came from a trace (`docs/archive/certification_checklist.md`,
  "real frame numbers without the owner", step 8); this bench does not trace.
- The Perf HUD is on screen during every run (it is the harness), the same in
  every run.

### `npm run bench:drag`: does dragging always work?

On a busy S2 mat, N **real drags** of each kind, sent as browser input
(`Input.dispatchMouseEvent`): the pointer rests on the source for 80 ms (as a
hand does), presses, makes one move under and one past the 8 px activation
distance, eases to the target in 10 steps a frame apart, wiggles, releases, and
waits 450 ms. Because it is real input, the browser's own hit-testing decides
what the press lands on, which is where "something is blocking the drag" bugs
live. Sources and targets are picked from the live DOM and state for every drag
(things move); targets are the best-cleared of 40 random points on the mat,
away from open drawers.

| Kind | Source → target | Success (read from the game's state) |
|---|---|---|
| hero dock → mat | a dock hero → an open spot | the hero's flag planted within 60 u of the aim (or pinned) |
| flag → mat | a planted flag → an open spot | the same |
| Token → mat | a Token on the mat → an open spot | the Token stands within 150 u of the aim |
| Token → bin | a Token → the discard bin | the Token is in the bin |
| bin → mat | a bin slot → an open spot | the Token is back on the mat |
| Shop row → mat | an affordable Shop row → an open spot | a new Token of that type stands there (it is then removed, so the mat cap never fills) |
| Bank item → dock hero | an equippable Bank item → a hero who can wear it | the hero wears it (their gear is cleared first) |

Every kind runs twice: a **plain** pass, and an **overlays** pass with speech
bubbles over every hero (a level-up event for each hero every 2.5 s, which also
fills the notification column) on top of any callouts S2 is showing. In both, every drag
must also pick up the right thing. The Perf HUD is hidden first (it is the
harness's own overlay and would cover the Shop's lower rows). Set-up is done
through the game's functions, never as a drag: Bank stock for the Shop's prices
and equippable items, unequipping before an equip, refilling or emptying the
bin, removing a bought Token. Both passes run on one page, kinds in the order
of the table, so the overlays pass starts with whatever the plain pass left
behind (for example a hero sheet opened and closed by the equip drops). That is
deliberate: leftovers like that are how a player meets a drag bug. The "other
drop targets there" note on a failure tells such a cause apart from the bubbles.

Fairness rules, so that a failure is the game's and not the bench's:

- **A Token** is pressed at its centre, or at another point of its art when a
  *different Token* lies on top there (overlapping Tokens: the player grabs the
  top one). Anything else on top, a ring, a callout, a bubble, is kept: that is
  what the bench is looking for.
- **A flag** is pressed at its highest point clear of every Token's art circle:
  by design a flag over a Token lets the pointer through to the Token
  (`FlagLayer.jsx`, `yieldToTokens`). A flag with no part over bare mat is still
  tried at its centre, and says so.

Per kind and pass it reports attempts, successes, success %, **pickup delay**
p50/p95 and the grouped **failure causes**:

- **press→start**: the press to the drag provider's start (`gi-dnd-active` on
  `<body>`, `DndKit.jsx`). It includes the bench's own 16 ms wait and two moves.
- **8px move→start**: from the move that crossed the activation distance to the
  start: the game's own pickup delay.
- a failure is one of: *never picked up* (with what `document.elementFromPoint`
  found at the press point after the hover: the nearest element with an
  identifying `data-` attribute, and in the dev build the React component names),
  *picked up the wrong thing* (what was in the hand, read from what each source
  draws while carried), *dropped, refused by the game* (the warning it raised),
  *dropped, no target took it* (the drop made the drag system's "invalid" sound;
  with what was under the drop point), or *state not as intended*. In the
  overlays pass each attempt also records how long before the release the last
  burst of level-ups went out (`msSinceOverlayBurst` in the JSON).

| Command | What it does | Time |
|---|---|---|
| `npm run bench:drag` | perf build, 50 drags per kind, both passes (700 drags) | ~13 min |
| `npm run bench:drag -- --n=10` | drags per kind and pass | |
| `npm run bench:drag -- --kinds=token,flag` | some kinds: `dockHero`, `flag`, `token`, `tokenToBin`, `binToMat`, `shop`, `equip` | |
| `npm run bench:drag -- --no-overlays` | the plain pass only | |
| `npm run bench:drag -- --dev` | the dev build: React component names for the blockers | |
| `npm run bench:drag -- --cpu=4` | CPU slowdown | |
| `npm run bench:drag -- --no-build` | reuse `dist-perf/` | |

| Exit | Means |
|---|---|
| 0 | every kind succeeded every time |
| 1 | at least one kind, in either pass, is below 100 % (so it can gate later work) |
| 3 | the bench failed |

JSON with every attempt (source, target, what was under the pointer, what was in
the hand, the drop sound, the game's notifications) goes to `bench/results/drag/`.
⚠️ The bench reports drag bugs; it does not fix them.
