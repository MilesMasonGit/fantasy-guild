# Concept — real offline progress

**Status:** decisions locked by the owner, 2026-10-07; built in brief 40
(O1–O4). Replaces the Time Bank (ruled 2026-10-06; removed in O4).

## The idea

When the player returns to a closed game, the game **simulates the time they
were away exactly**, as if they had watched: work cycles, spawns, growth and
turns, upkeep, fights and wounds. A loading bar shows it happening, then a
"While you were away" summary shows what changed.

## Locked decisions

| | Decision |
|---|---|
| Method | **Exact simulation, sped up**: the real engine in a fast catch-up mode, not an estimate from rates (an estimate would ignore the living mat). |
| Cap | **24 hours** of time away; anything beyond is dropped. |
| Speed | **A full 24 h catches up in under 30 seconds** on the owner's PC. |
| While it runs | A **loading bar or other visuals**, so the game never looks frozen. |
| On return | A **"While you were away" summary**: time away, items gained and spent, level-ups, Tokens depleted, heroes wounded. Level-up bubbles also wait on the hero bar. |
| Danger | **Same rules as playing**: fights, wounds and running out of seeds all happen offline. |
| What counts | **A closed game, and a sleeping PC** (lid shut; owner, 2026-10-07). A minimised or background window just runs (slowly); it doesn't get a catch-up or summary. |
| Time Bank | Retired: its banking, speed-up presets and hidden widget go. |

## What was known at the start

- The engine ticks 10 times a game-second; a realistic mat costs ~0.3 ms per
  tick (`docs/reference/PERFORMANCE.md`). Running today's ticks exactly takes
  ~11 s per hour away, **~4–5 minutes for 24 h**: about 10× too slow for the
  30-second target.
- A live tick is clamped to 1 s (`MAX_TICK_DELTA_MS`); longer gaps are
  published as `TIME_OVERFLOW` and were banked by the Time Bank.
- Hero walking already snaps to its destination on a very long tick.
- The Time Bank already measured time away on load (`now − savedAt`).

## Open engineering questions (for the roadmap, not the owner)

1. **How to reach 10× speed while staying exact.** Candidates: larger catch-up
   steps where systems handle them correctly (cycles, clocks and spawns already
   advance by `delta`), skipping drawing and UI events entirely during
   catch-up, running in a Web Worker so the loading bar stays smooth. Prove
   "exact" with the bench's same-work fingerprint: a catch-up must end in the
   same state as running the same time live.
2. **Saving during catch-up**: the save happens once at the end; a crash
   mid-catch-up must not lose the pre-catch-up save.
3. ⚠️ **Background windows.** Browsers throttle background timers hard (Chrome
   can wake a background tab about once a minute after a few minutes), so
   "runs slowly" may mean "nearly paused". Measure what the desktop app
   (Tauri webview) does when minimised before building; if a minimised game
   effectively stops, bring the choice back to the owner.
4. **What the summary counts**: the engine already publishes the events
   (cycle complete, level-up, depleted, wounded); catch-up collects them
   instead of showing toasts and bubbles.

Questions 1–3 are answered in the catch-up plan below; question 4 is in its
"What a catch-up skips" list.

## Catch-up plan (O1, 2026-10-08)

**M** = measured, **R** = reasoned. Measured on the owner's PC (i7-8700,
Node 24.11.1, Chrome 154 headless for the in-page runs) at `5e1b220d`, with
other agents working on the machine (~35 % CPU busy before the runs; the
in-page runs with the virtual clock overlapped another agent's drawing
bench), so the times are if anything slow. Re-measure on a quiet machine
before calling the target met. The
board is the bench's S2 (101–109 Tokens, over the game's 80-Token cap: a busy
board), seed 1, with the bench's virtual wall clock. Tools:
`bench/catchup/time.mjs` (headless) and `bench/catchup/page.mjs` (the real
page); see `bench/README.md`, "Catch-up timing".

### What 24 hours cost today, and with the plan (M)

| Engine | Step | 1 h | 6 h | 24 h |
|---|---|---|---|---|
| Headless (bench) | 100 ms, today's tick | 11.3 s | 66.4 s | **231.5 s** (864,000 ticks) |
| Headless | 200 ms | 7.0 s | 39.1 s | 135.4 s |
| Headless | 500 ms | 3.2 s | 17.8 s | 70.3 s |
| Headless | 1000 ms | 2.3 s | 12.6 s | 47.8 s (86,400 steps) |
| Real page, UI listening | 100 ms | 7.3 s | | ~175 s (×24, R) |
| Real page, UI muted (estimate\*) | 100 ms | 5.4 s | | ~130 s (×24, R) |
| Real page, UI listening | 1000 ms | 2.5 s (3 runs, 2.40–2.61) | | **43.7 s** |
| Real page, UI muted (estimate\*) | 1000 ms | 1.1 s (3 runs, 1.10–1.16) | | **22.0 s** |

\* Each event keeps only as many listeners as the engine registers headless
(66 of the page's ~350), the first ones in subscription order. It may keep or
drop the wrong listener on a few events, so that run's work is not proven
identical. O2's real mute replaces it.

- Today's ticks take **~4 minutes** headless for 24 h (the concept's 4–5 min
  was right), 2–3 min in the page. Heap stayed flat (69 → 71 MB after GC);
  the slowest single tick was 7.3 ms.
- **1000 ms steps plus muting the UI's listeners: 22 s for 24 h in the real
  page, inside the 30 s target with ~25 % to spare.** Neither alone is
  enough: 1000 ms steps with the UI listening take 44 s.
- Bigger steps buy 4.8×, not 10×: a step costs twice as much at 1000 ms
  (0.27 → 0.55 ms headless), because the work done per game-second (idle
  heroes re-choosing every second, loot sweeps, cycle completions, enemy
  strolls) does not shrink with fewer steps.
- The headless numbers are about **twice** the page's for the same board (R:
  Vite's SSR loader turns every imported call into a property lookup; the
  shipped build is bundled). Judge the 30 s target in the page.

### Where the time goes (M, V8 profile, headless)

**Today's 100 ms ticks** (1 game-hour, % of tick time, inclusive): the board
handler is 93 % (`BoardRunner.tick` 88 %). Inside it, the walk over every
Token is about half: `BoardRunner.tick`'s own loop 16 % (self),
`workerOf` 7 %, `WorkCheck.fixableReason` 7 %, `heroOfInstance` 6 % (a
linear scan of every claim, once per Token per tick). Then
`TimedChanges.tick` 19 % (every Token's clocks, every tick), `Flags.assign`
8.5 %, `EnemyMotion` 4.4 %, `HeroMotion` 3.7 %, `QuestTokens.tick` 3.2 %,
`Hostiles` 2.9 %, `EventBus.publish` 2.7 %. Completing work cycles, the
actual work, is **2 %**: almost all of a tick is checking every Token for
something to do, which is why fewer, bigger steps pay.

**1000 ms steps** (6 game-hours): `BoardRunner.tick` 88 % (own loop 9 %),
`Flags.assign` 21 % (`evaluate` 15 %, `choose` 12 %: idle heroes looking for
work once a second), `EventBus.publish` 19 % (engine listeners:
`TileModifiers.rebuildTokens` 6.5 % after enemy strolls end, loot collection
5.5 %), `TimedChanges` 11 %, `EnemyMotion` 11 %, `completeCycle` 8 %,
`SpriteLayer.tick` 6 %, `fixableReason` 6 %, `Hostiles` 4 %. These are the
places to look if a real board misses 30 s.

### Background windows (M): question 3 answered

- **Desktop app, minimised 8 minutes** (the owner's release build: Tauri
  2.11.5, wry 0.55.1, WebView2, the same versions as today's
  `Cargo.lock`): a 100 ms timer kept firing 10 times a second (worst gap
  106 ms), the page stayed `visible`, and **it kept drawing at ~165 frames a
  second**. WebView2 is never told the window is minimised. So a minimised
  game runs at full speed, not slowly: no catch-up and no owner question
  needed.
- **Browser build, real Chrome window**: hidden, a 100 ms timer fires once a
  second; after ~5 minutes hidden, **once a minute** (Chrome's intensive
  throttling). The 1-a-second phase still plays in real time (the 1000 ms
  clamp lets each tick deliver a full second, plus ~10 ms of overflow); the
  once-a-minute phase delivers 1 s of play a minute and pushes ~59 s into
  `TIME_OVERFLOW`, which the Time Bank kept. See owner question 2.

### Step size: one 1000 ms step for the whole engine

All systems take the same step, in their usual order, exactly as
`DevTools.advanceTime` already does (`DEV_ADVANCE_STEP_MS` =
`MAX_TICK_DELTA_MS`): the systems interact inside a tick, so a separate step
per system would change what they see of each other (R). 1000 ms is the
largest safe step (R): `BoardRunner` completes at most one work cycle per
tick and floors cycles at 1000 ms, `EnemyMotion` walks at most 1000 ms per
step, and combat makes at most one attack per side per tick.

| System | How it advances (code) | At 1000 ms steps |
|---|---|---|
| **Work cycles** (`BoardRunner`) | one completion per tick; the overshoot is **dropped** (`completeCycle` zeroes `cycleElapsedMs`) | −4.0 % cycles, −4.5 % Bank items after 1 h (M). **Fix: carry the overshoot** → within 0.1 % (M) |
| Spawns, growth, passive output (`TimedChanges`) | clocks keep their overshoot, several changes per tick | exact rate (R) |
| Status effects, live effects (5 s clocks), block upkeep, quest clock, trigger cooldowns | overshoot kept / countdown | exact (R) |
| Combat (`CombatProcessor`) | attack timers keep their overshoot, one attack per side per tick | exact while an attack interval is ≥ 1 s (base 2.5 s and 3 s) (R) |
| Regen, wounded recovery | linear / countdown | exact (R) |
| Hero walking (`HeroMotion`) | straight steps, never overshoots | arrives up to 1 s later per walk (R) |
| Hostiles looking for heroes | 250 ms clock, reset rather than carried | looks once a second instead of every 300 ms (R) |
| Flags retry | `RETRY_MS` = 1000 | same cadence (R) |
| Loot auto-collect (`SpriteLayer`) | timer reset to 0; a sprite's age read from `Date.now()` | every 3 s instead of 2.5 s; needs the game clock (below) |
| Rules that read the wall clock | `LiveEffects` expiry, loot absorb and age, the XP and item rate windows | **wrong in a catch-up without a game clock** (below) |

**Fidelity: bigger steps against today's 100 ms ticks** (M, S2, change in the
totals the board produced; seed 1, one run each):

| | Bank items 1 h / 6 h / 24 h | Cycles 1 h / 6 h / 24 h | Depleted, spawned, fights won 24 h | Hero XP |
|---|---|---|---|---|
| 1000 ms, today's rule | −4.5 % / −4.0 % / −1.0 % | −4.0 % / −3.6 % / −1.0 % | −2.5 % | ≤ −0.4 % |
| 1000 ms, overshoot carried (spike, both sides) | −0.0 % / 0.0 % / −0.1 % | 0.0 % / −0.0 % / −0.1 % | +0.1 % | ≤ −0.0 % |
| 500 ms, today's rule | −0.8 % / −0.9 % / −0.5 % | −0.7 % / −0.8 % / −0.6 % | −2.0 to −2.1 % | ≤ −0.1 % |

The carry spike rewrote `BoardRunner.js` only as it was loaded into the
measuring process (the file was untouched): a finished cycle's overshoot is
added to the next cycle if that cycle starts on the very next tick, and
`cycleElapsedMs` still starts at 0 so `CYCLE_START` still fires once. It also
lifts today's live production by ~0.5 % (2,382 → 2,393 cycles in the first
hour): live ticks lose the overshoot too, and real ticks jitter (100–106 ms
measured in the desktop app). That makes it a gameplay change: owner
question 1.

### Exactness, honestly

**A catch-up in 1000 ms steps can never have the same fingerprint as live
100 ms ticks** (M): even at 200 ms the end state differs, and the number of
random draws falls by 71–90 % (things that roll every tick roll fewer
times). And live play is not 100 ms exact either: its ticks jitter. So the
gate has two parts:

1. **Identity (strict, bench exit 2).** A catch-up must do exactly what the
   same 1000 ms steps do through plain `GameLoop.runHandlers`: same
   fingerprint, random draws included. This proves the catch-up mode itself
   (muted UI, game clock, slices, save suspended) changes nothing.
   *Built (O2.5):* the fingerprint leaves the wall-clock time out of ids
   (`tok_<ms>_…`, `sprite_<ms>_<n>`): S8's virtual wall clock stands still as
   the real one nearly does, so its ids differ from S8L's by design.
2. **Fidelity (tolerance).** 1000 ms steps against 100 ms ticks, S2, one
   game-hour: Bank items, hero XP, cycles and depletions within ±1 %
   (measured with the carry: ≤ 0.1 %; without it the check fails at −4.5 %,
   which is the neutered guard). *Built (O2.5):* depletions are ~6 a
   game-hour on S2, too few for a percentage, so each count may also be off by
   one. Measured after a save and load: 0.00 % on all four; without the carry
   −4.59 % Bank items.

### The game clock

Some rules read `Date.now()`, which moves only as many seconds as the
catch-up takes, ~22 s for 24 h (R, from the code): `LiveEffects`
(`expiresAt`, saved on heroes), `SpriteLayer` (`absorbAt`, `bornAt` and
the auto-collect age), the XP and item rate trackers, and
`ModifierAggregator`'s expiry (no caller sets one today). The bench hides this, because its prelude makes `Date.now()` follow
the ticks. Without a fix, an effect with a minute left when the game closed
ends at once on load instead of a minute in, and loot made during the
catch-up is collected late (hitting the 40-stack cap and its sweep). So:
one `GameClock.now()` that is `Date.now()` in live play and, during a
catch-up, starts at `savedAt` and moves with the steps. Ids, save stamps,
notifications, glows and `TimeManager` keep the real clocks. (This also
settles ticket T-085, "loot timing uses the wall clock".)

### What a catch-up skips

- **Drawing**: nothing redraws, because the UI's listeners are muted and
  O3's catch-up screen covers the mat. *Built (O2.6):* one `GAME_RESET` is
  not enough: the UI that reads through `useGameState` hears only the events
  it names, so the end announces what a load does (`GAME_RESET`, then
  `state_changed`, `heroes_updated`, `inventory_updated`, once each), and a
  promotion offer made during the catch-up is re-read on `GAME_RESET`.
- **UI events**: muted at the bus by **listener tag**, not by event name
  (an engine listener on a "UI-looking" event would be lost). The page has
  ~350 listeners against the engine's 66; muting is the 2.0–2.2× above (M,
  estimate). `PROGRESS` events need not be published at all (2.8 a step,
  no engine listener).
- **Sounds**: `AudioSystem` silent. *Built:* silenced after a sound's
  variant is picked, not before: the pick draws from the game's shared
  random stream, and the identity gate needs the catch-up to draw exactly as
  play at volume 0 does.
- **Notifications and toasts**: `NotificationSystem` stands down (S2 makes
  ~2,200 notification updates a game-hour, M); the summary collects instead.
  *Built:* the toast subscriptions (`NotificationSubscriptions.js`) are tagged
  UI as well, so the bus skips them.
- **The summary's counts** come from engine events while it runs: items
  gained and spent (`inventory_updated`'s `added` / `removed`, plus a Bank
  diff before and after, since two Bank paths publish no amounts), level-ups
  (`hero_leveled`), Tokens depleted (`board:token_depleted`), heroes wounded
  (`board:hero_defeated`, `hero_downed`), fights won (`combat_victory`).
  Level-up bubbles wait for the hero bar (O3).
- **Autosave and the save on closing the window**: suspended until the end.
- **The Time Bank**: its accrual on load and its tick must not run (O4
  deleted it), or the time away is both played and banked.

### Web Worker: no

The page does 24 h in 22 s on the main thread (M), so a worker buys only a
smoother bar, at a high price (R): the engine would have to boot in the
worker (module-level singletons, registries loaded through
`import.meta.glob`, engine code that touches `document`, `localStorage` and
`Audio`), and its state come back through save and load, whose round trip
of runtime-only state (the flag runtime, hero bodies, tile caches) nobody
has proved lossless. Instead: run the steps in slices of ~50 ms of work
(~150 steps), yield between slices with a `MessageChannel` (not
`requestAnimationFrame`, which a hidden window never fires; not
`setTimeout`, clamped to 4 ms), update the bar between slices, and animate
the bar with CSS `transform` / `opacity` so the compositor keeps it moving
even inside a slice. Yielding costs ~1 ms a slice, ~2 % (R).

### The 24 h cap and the crash-safe save

1. `loadSlot` → `initFromSave` → `game_loaded` with `savedAt`, as today. In
   `EngineBootstrap.onSlotSelected`, after the system inits and **before**
   `GameLoop.start`: away = `Date.now() − savedAt`. Nothing to do if it is
   under one step or negative (the clock moved back). Play
   `min(away, 24 h)`; the rest is dropped and reported.
2. While it runs, autosave and the closing-the-window save are suspended, so
   the slot and its backup keep the pre-catch-up save byte for byte. A
   crash or a closed window loses nothing: the next load starts the same
   catch-up again (with different dice: randomness is unseeded, T-088).
3. At the end: play the real seconds the catch-up itself took (within the
   cap), save once, resume autosave, publish `GAME_RESET`, start the loop.
   `GameLoop.start` re-reads the clock, so nothing is counted twice.
4. When the cap dropped time, the game clock ends behind the real clock by
   that much, so wall-clock stamps (effects, loot) are that much in the
   past and end at once: right, since that time was dropped.

**A sleeping PC (O4)**: the first tick after waking carries the whole gap as
`TIME_OVERFLOW`. In the desktop app that only comes from sleep or a stalled
frame (minimised does not throttle, M). In a background browser tab it
arrives every tick (~10 ms) and, after 5 minutes, ~59 s a minute (M). So O4
needs a threshold: a gap of 2 minutes or more pauses the loop and runs the
catch-up with the bar and the summary; a smaller gap is played silently as
extra 1000 ms steps inside the tick (owner question 2). *Built in O2.6, not
O4* (director, 2026-10-08): `CatchUp` listens for `TIME_OVERFLOW`
(`CATCH_UP.SHOW_GAP_MS`); a shorter gap runs through the same `CatchUp.run` in
one slice, quiet, before the tick's own step; less than a step waits for the
next gap. The Time Bank no longer banks either gap.

### Slices for O2

Tests first; each slice ends with the merge gate (TESTING.md). Order:
O2.1 and O2.2 (independent), O2.3, O2.4, O2.5, then O2.6.

| Slice | What | Tests first | Done when |
|---|---|---|---|
| **O2.1 Carry the cycle overshoot** | `BoardRunner`: a finished cycle's overshoot starts the next cycle if it starts on the next tick; `cycleElapsedMs` still starts at 0 (`CYCLE_START` once); a station that waits loses it. | `BoardRunnerCarry.test.js`: "a 1500 ms cycle completes 40 times in 60 s at 100 ms ticks and at 1000 ms steps"; "cycle times 1000, 1234, 2500 and 8000 ms complete as many cycles, give or take one, over 10 game-minutes at either step"; "CYCLE_START fires once per cycle"; "a station waiting for inputs after a cycle keeps no overshoot". | Tests and suite green; owner question 1 answered (or A by default); `npm run bench -- --accept-work-change=<ticket>` (every scenario's work changes, deliberately); `time.mjs` 1 h at 100 vs 1000 ms within 0.1 % on Bank items and cycles. |
| **O2.2 Game clock** | `GameClock.now()`; switch `LiveEffects`, `SpriteLayer` (absorb, age), the rate trackers and `ModifierAggregator` to it. Fix `DevTools.advanceTime`'s wall-clock warning (its "quest-abandon cooldowns" no longer read the wall clock). | `GameClock.test.js`: "live, it is Date.now()"; "in a catch-up it starts at savedAt and moves only with the steps". `LiveEffectsCatchUp.test.js`: "an effect with 60 s left when the game closed ends 60 s into the catch-up". `SpriteLayerCatchUp.test.js`: "loot made in a catch-up is absorbed 1.1 s and auto-collected 2.5 s of game time after it lands". Guard `RulesUseGameClock.test.js`: "src/systems reads Date.now() only in the allow-listed files". | Tests green; `npm run bench -- --compare` exits 0 (same work: the bench's clock already follows the ticks). |
| **O2.3 Mute the UI's listeners** | `EventBus.subscribe(name, fn, { ui: true })` (or a `subscribeUi` helper) on every listener under `src/ui` (about 55 calls in 27 files); `EventBus.setQuiet(on)` skips tagged listeners. | `EventBusQuiet.test.js`: "a quiet bus skips UI listeners and still calls engine ones". Guard `UiListenersTagged.test.js`: "every subscribe under src/ui is tagged". | Tests green; bench same work; `page.mjs` switched from its estimate to the real mute. |
| **O2.4 The catch-up driver** | `CatchUp.run({ savedAt, now, capMs, stepMs: 1000, sliceMs: 50, onProgress })` → `{ simulatedMs, droppedMs, steps, summary }`: game clock on, bus quiet, notifications, sounds and the Time Bank's tick off, autosave and the closing save suspended, slices with yields, everything restored in `finally`. | `CatchUp.test.js`: "plays min(now − savedAt, 24 h) and reports the rest as dropped"; "does nothing for a gap under one step or a savedAt in the future"; "gameTimeMs advances by exactly the time played"; "UI listeners hear nothing while it runs and one GAME_RESET after"; "no toast, sound or Time Bank change while it runs"; "localStorage is untouched until it ends, and a throw half-way leaves the slot byte for byte"; "the summary counts items gained and spent, level-ups, Tokens depleted, heroes wounded"; "it yields between slices and reports progress from 0 to 1". | Tests and suite green; bench same work. |
| **O2.5 Identity and fidelity gates** | Bench S8 (S2 saved, loaded, then `CatchUp.run` for one game-hour) and S8L (the same save and load, then 3,600 × `runHandlers(1000)`): `run.mjs` fails with WORK CHANGED unless their fingerprints are equal. Fidelity: one game-hour at 100 ms against 1000 ms within ±1 % (Bank items, XP, cycles, depletions). Added to `baseline.json` as new scenarios. | Neutered guards: CatchUp skipping the game clock → S8 ≠ S8L, exit 2; the carry removed → fidelity fails at ~−4.5 %. | `npm run bench -- --compare` exits 0 with the new checks; both guards proven to bite. |
| **O2.6 Catch up on load** | In `onSlotSelected` (not a new game), `await CatchUp.run(...)` before `GameLoop.start`, then the top-up, one save, `GAME_RESET`. The Time Bank no longer banks a closed game's gap. A progress event for O3's bar. | `CatchUpOnLoad.test.js`: "loading a save written 2 h ago starts the loop 2 game-hours later and saves once"; "a save written 30 h ago plays 24 h"; "a new game does not catch up". | In the game: a planted test slot (an empty slot, TESTING's slot discipline) with `savedAt` 24 h back catches up, ends 24 game-hours on, saves once; `page.mjs --hours=24` with the real mute ≤ 30 s. The bar and summary are O3. |

### Owner questions (both reversible: O2 and O4 build the recommendation unless the owner says otherwise)

**Q1. A work cycle's leftover time.** Today, when a cycle finishes part-way
through a tick, the leftover is thrown away. Offline in 1-second steps that
loses up to 4.5 % of production.
- **A (recommended): keep the leftover**, live and offline. A 1.5 s cycle
  really runs 40 times a minute; live production rises ~0.5 % on the bench
  board; offline matches live within 0.1 %.
- B: keep today's rule and catch up with today's 100 ms ticks: exact, but
  24 h takes ~2–3 minutes in the app.
- C: keep today's rule and catch up in 1 s steps anyway: offline produces
  1–4.5 % less than playing.

**Q2. A game left in a background browser tab** (the browser build only;
the desktop app keeps running when minimised). After 5 minutes Chrome wakes
it once a minute, so it nearly pauses.
- **A (recommended): it quietly keeps time.** Each wake-up plays the minute
  it missed, with no bar or summary; only a gap of 2 minutes or more (a
  sleeping PC) shows the bar and the summary.
- B: treat it like a sleeping PC: the bar and the summary on every return.
- C: leave it nearly paused; the missed time is dropped once the Time Bank
  is gone.

### Corrections to the brief and this concept (checked against the code)

- "A minimised window just runs (slowly)": the desktop app runs at **full
  speed** when minimised, and keeps drawing (M). A background browser tab
  plays in real time for ~5 minutes, then ~1/60 speed (M).
- Brief O2's "~10× today's speed": bigger steps give 4.8× (M); the 30 s
  target also needs the UI's listeners muted.
- "Cycles, clocks and spawns already advance by `delta`": clocks and spawns
  keep their overshoot, **work cycles drop it**, which is what makes bigger
  steps lose production.
- Brief O2's exactness gate (catch-up fingerprint = live fingerprint) cannot
  hold for any step but 100 ms (M); it is split into identity and fidelity
  above.
- "Save once at the end": today the autosave timer and the save on closing
  the window would both write a half-caught-up game; they must be suspended.
- O4's "`TIME_OVERFLOW` (lid-shut gaps)": a background browser tab produces
  it too, every tick (M); hence the threshold.
- The wall-clock rules (game clock above) are not in the brief or concept.
- `npm run bench -- --cpu-prof` writes the module-loader thread's idle
  profile on Node 24, not the engine's (M); `bench/README.md` says how to
  profile until it is fixed.
- S2, the bench's "realistic" board, holds 101–109 Tokens, over the game's
  80-Token cap; a capped board should be cheaper (R), so S2 is a fair
  worst case for the 30 s target.
