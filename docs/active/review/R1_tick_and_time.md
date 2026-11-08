# R1: Tick and time

*Reviewer session R1, 2026-11-07, read at `main` **08d86ba1** (code identical to ea6b9f92 in this
area) in the worktree `.claude/worktrees/rw`. Files read whole: `src/systems/core/GameLoop.js`,
`TimeManager.js`, `GameClock.js`, `EventBus.js`, `engineEvents.js`, `EngineBootstrap.js`,
`CatchUp.js`, `DevTools.js`, `src/config/loopConstants.js`, `src/systems/notifications/catchUpNews.js`
and `routing.js`; the seven tick handlers' entry functions (`RegenSystem`, `WoundedSystem`,
`QuestManager`, `SpriteLayer`, `LiveEffects`); the round-3 R1 findings and their tickets; the engine
bench baseline (`bench/baseline.json`), the soak baseline and `bench/README.md`'s catch-up sections.
Every path below was checked to exist at 08d86ba1.*

## Session summary (for the owner)

**What this area is.** The game's heartbeat: a timer fires ten times a second, works out how much
time passed, and runs seven jobs in a fixed order (the clock, live effects, hero regeneration, the
whole mat, bounties, loot on the floor, wounded heroes). Everything that happened is announced on
one event bus, which the screen listens to. When the game was closed, or the PC slept, the
catch-up plays the missed time through those same seven jobs in one-second steps, quietly, then
shows "While you were away".

**How healthy it is.** Very good. This is the best-kept corner of the code: 2,000 lines, every
non-obvious decision explained in place, and most of round 3's findings here were fixed (the tick
no longer trusts the wall clock; the catch-up plays through the real handlers and is proven
identical to live stepping by the bench's identity gate). The loop and bus themselves do no
per-tick work worth measuring: the engine bench puts a whole tick at 0.31 ms median on the
realistic board (S2) and 0.77 ms on the torture board (S3), and that time is in the handlers,
not here. Nothing in this area needs a bench run.

**The three findings that matter most.**
1. **CR4-013**: the slot screen's "playtime" grows while the catch-up plays. Come back after a
   day away and your save says you played a day longer. Small, visible, and the owner should say
   what "playtime" means before it is fixed.
2. **CR4-014**: four sounds (defeat, invasion, hero assigned, skill levelled) and one "status
   changed" listener wait for moments the engine never announces, so they never play or fire.
   The owner decides: wire the moments, or drop the sounds.
3. **CR4-015**: live rules with a clock on them (status expiry, loot ageing, rate windows) read
   the PC's wall clock, so a manual clock change mid-session moves them all at once. Rare, but
   the tick itself was moved off the wall clock for exactly this reason in round 3.

**Counts.** 5 findings: 2 `bug`, 1 `owner-decision`, 1 `perf` (reasoned, P3), 1 `cleanup`.
All 5 verified by a second reader (Sonnet, read-only), who corrected one count; none refuted.

**For the director to measure first.** Nothing. The catch-up's fidelity to live play is already
ticketed with numbers (T-324, T-325) and guarded by the bench's S8 gates. If CR4-016 is pursued,
the hypothesis to test is in it (count `GAME_RESET` while a real tab is throttled).

**What this area looks like, in plain words.**
- *The tick.* `setInterval` every 100 ms (`GameLoop.js:34`); the delta is measured with
  `performance.now()`, floored at 0 and clamped to 1,000 ms; anything past the clamp is parked as
  overflow and handed to the catch-up (`TimeManager.js:43-54`, `GameLoop.js:66-71`). Seven handlers
  at priorities 10 to 70 (`EngineBootstrap.js:164-209`), each in its own `try/catch`. The soak
  baseline shows the tick keeps its 10 a second while the window is hidden (`baseline/soak.txt`,
  "tick/s" column), so nothing here depends on the page being visible.
- *The bus.* One `Map<name, Set<fn>>`, synchronous, in subscription order (`EventBus.js:84-108`).
  Fan-out through the bus is modest: the most-subscribed events are `GAME_LOADED` and
  `BOARD_SWAPPED` at 8 direct subscriptions each; the per-tick events (`HEROES_WALKED`,
  `ENEMIES_WALKED`, `PROGRESS` every third tick, `HERO_MOVED`) have 1 to 3 direct subscribers, the
  rest reaching Tokens through the per-Token switchboard (R5). 43 engine event names, 10 UI, 6
  declared orphans (subscribed, never published), 7 declared no-listener events (`engineEvents.js`).
- *The catch-up.* `CatchUp.run` (`CatchUp.js:291-390`) plays `min(time away, 24 h)` in 1,000 ms
  steps through `GameLoop.runHandlers`, in ~50 ms slices with a `MessageChannel` yield between
  them, the bus quiet for UI listeners, saving suspended, the game clock stepping from the save's
  `savedAt`; it saves once at the end. A live gap under 2 minutes plays synchronously inside the
  tick that found it (`:111-116`); 2 minutes or more stops the loop and shows the bar (`:100-109`).
  Measured 2026-10-08: 24 hours in 23.9 s in the page (`bench/README.md`, "Catch-up timing").
  The bench's identity gate proves catch-up mode changes nothing (S8 = S8L); its fidelity gate
  keeps 1 s steps within ±1 % of 100 ms ticks on Bank items (baseline: S8L 3,851 against S8F
  3,825, +0.68 %); the known residual bias is T-325.
- *Already ticketed, not re-filed.* `STATE_CHANGED`'s last publisher (`Atlas.js:499`): T-195.
  Timed effects and the wall clock across a reload: T-077 (latent). Engine init not safe to run
  twice: T-081 (latent). Catch-up step bias and the flaky fidelity seed: T-325, T-324.

---

## Findings

### CR4-013  "Playtime" on the slot screen counts the time the catch-up played
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/core/EngineBootstrap.js:166-172` (the `time_tracking` handler adds `delta` to `meta.totalPlaytime`), `src/systems/core/CatchUp.js:343,358` (the catch-up drives the same handlers with 1,000 ms steps), `src/systems/core/DevTools.js:101` (so does the dev time skip), `src/systems/core/SaveSlotHelper.js:57` and `src/ui/modals/SlotSelectionModal.jsx:22,210` (shown as "playtime")
- **What**: Every handler the loop runs also runs during a catch-up; that is the design, and right for `gameTimeMs`. But the same handler also adds each delta to `meta.totalPlaytime`, which the slot screen formats as the save's lifetime playtime (`formatPlaytime`, "2h 5m"). A player who closes the game for a day and opens it comes back to a save that says they played 24 hours more; the dev time skip does the same. The comment on the field says "Lifetime playtime for the save-slot screen", so the number has drifted from its meaning rather than been redefined.
- **Evidence**: `EngineBootstrap.js:170`: `GameState.state.meta.totalPlaytime = (… || 0) + delta;` inside the handler registered with `GameLoop.onTick('time_tracking', …)`; `CatchUp.js:343`: `GameLoop.runHandlers(stepMs)` in the step loop; `GameLoop.js:85-96`: `runHandlers` calls every registered handler. `grep -rn totalPlaytime src` outside tests: the three sites above only.
- **Fix sketch**: Add to `totalPlaytime` only when not catching up: `if (!GameClock.isCatchingUp()) …` in the handler (`GameClock.js:37`), or move the addition into `GameLoop.tick()`'s live path. Must not change: `gameTimeMs` (the rules' clock, which must advance during a catch-up), the bench work fingerprint (it does not read `totalPlaytime`; check `bench/lib/fingerprint.mjs`). **Owner question before fixing** (one line, for the planning agent's batch): should "playtime" mean time the game was open (fix as above), or time the guild has lived including time away (then rename the label and close this)?
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. Read the handler (guarded only by getIsInitialized), runHandlers, the two CatchUp call sites and DevTools.js:101; GameClock.isCatchingUp has one caller in src outside tests (SpriteLayer.js:247), so nothing guards the addition; grep over src, bench, cms outside tests finds exactly the three totalPlaytime sites; bench/lib/fingerprint.mjs does not read it. Noted that TickDeltaClamp.test.js:21 covers the live-tick clamp on totalPlaytime, a different path.
- **State**: ticket T-369 (owner 2026-11-07: whole guild time, comment fix only) (triaged 2026-11-07)

### CR4-014  Four sounds and one listener wait for moments the engine never announces
- **Tag**: owner-decision
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/core/engineEvents.js:242-255` (`ORPHAN_EVENTS`: six names "subscribed somewhere with no publisher"); subscribers: `src/systems/core/AudioSystem.js:86,87,89,92` (`SKILL_LEVELED` → levelup, `INVASION_STARTED` → invasion, `COMBAT_DEFEAT` → defeat, `HERO_ASSIGNED` → hero_assign), `src/ui/components/dock/DockHeroFigure.jsx:136`, `HeroDockTab.jsx:143`, `src/ui/components/drawer/HeroInspectionSheet.jsx:59` (`HERO_STATUS_CHANGED` in their event lists), `src/config/registries/triggerRegistry.js:283` (`EFFECT_TICK`)
- **What**: Round 3 found engine events subscribed with no publisher and the fix was to pin them in a list so the set can only shrink; the list's own comment calls them "dead listeners owned by other tickets", but no open ticket names any of them (grep of `TICKETS.md` for the six names: none). The effect for the player: the audio system has a defeat sound (`bookFlip2.ogg`) and an invasion sound wired to `COMBAT_DEFEAT` and `INVASION_STARTED`, which nothing publishes, so a hero's defeat makes no sound of its own (the knockout banner's warning tone, `routing.js:248`, is what plays today). `HERO_ASSIGNED` and `SKILL_LEVELED` duplicate `HERO_DEPLOYED` and `HERO_LEVELED`, which are published and already wired to the same clips (`AudioSystem.js:85,91`), so those two subscriptions are pure residue. `HERO_STATUS_CHANGED` in three UI event lists costs a `Set` entry each and never fires; `EFFECT_TICK` is a trigger-moment name whose statements `LiveEffects` fires directly.
- **Evidence**: `grep -rn "publish(ORPHAN_EVENTS\|'combat_defeat'\|'invasion_started'\|'hero_assigned'\|'skill_leveled'\|'hero:status_changed'\|'effect_tick'" src` outside tests: none; `EngineEventNames.test.js` forbids raw strings so a hidden publisher cannot exist. `AudioSystem.js:323-336`: the clip map has `'defeat'` and `'invasion'` paths. `engineEvents.js:242-255` as cited.
- **Fix sketch**: Owner's choice, as a multiple-choice line: (a) **wire the moments**: subscribe the defeat sound to `BOARD_EVENTS.HERO_DEFEATED` (published, `boardEvents.js`) and decide whether a settled place's arrival (`ATLAS_CHANGED` with `reason: 'occupied'`) is the "invasion" moment; delete the two duplicate subscriptions, the `HERO_STATUS_CHANGED` list entries and the `EFFECT_TICK` row; then `ORPHAN_EVENTS` is empty and goes. (b) **drop them**: delete all six subscriptions and the `ORPHAN_EVENTS` object; the defeat and invasion clips become unused files. Either way one builder-lite slice plus the guard test. Must not change: the sounds that play today (`AUDIO_PLAY`, levelup on `HERO_LEVELED`, victory, quest claim, hero_assign on `HERO_DEPLOYED`, the banner tones).
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. Grepped the six raw strings and five constants over src, cms and bench outside tests: declarations and the cited subscribers only, no publisher; clip map has invasion (bookFlip1) and defeat (bookFlip2); AudioSystem.js:85 and :91 are the live duplicates; TICKETS.md names none of the six; BOARD_EVENTS.HERO_DEFEATED is published at BoardCombat.js:538.
- **State**: ticket T-376 (owner 2026-11-07: drop both sounds) (triaged 2026-11-07)

### CR4-015  Live rules read the wall clock, so a clock change moves every timed rule at once
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / medium
- **Confidence**: reasoned (the mechanism is read from the code; no clock step was staged)
- **Where**: `src/systems/core/GameClock.js:17-19` (`now()` is `Date.now()` outside a catch-up); readers: `src/systems/effects/LiveEffects.js:170,390,554` (status `expiresAt` and expiry check), `src/systems/effects/ModifierAggregator.js:273,310`, `src/systems/board/SpriteLayer.js:324-326,527` (loot `bornAt`/`absorbAt`, the cap sweep and auto-collect age), `src/systems/hero/XpRateTracker.js:31,42,65`, `src/systems/inventory/ItemRateTracker.js:25,47,74`, `src/systems/combat/WoundedSystem.js:63` (legacy saves only); the stale comment at `src/systems/core/TimeManager.js:29-31`
- **What**: Round 3 (CR3-101) moved the tick off the wall clock onto `performance.now()` because a clock step made working Tokens replay their cycle start every tick. The rules that compare moments were given `GameClock.now()`, which is the right seam, but in live play it is still `Date.now()`. So a manual clock change forward by an hour expires every status on every hero and enemy at the next 3 s rules tick, ages every loot stack past the auto-collect delay, and empties both rate windows; a change backward keeps statuses an hour longer and freezes the rate displays. The comment at `TimeManager.js:29-31` lists "DST" among the steps: `Date.now()` is epoch time and does not move at a DST change, so only manual changes and large NTP corrections are the real cases. Rare on a desktop PC, but the fix is small and the seam already exists.
- **Evidence**: `GameClock.js:18`: `return catchUpNowMs ?? Date.now();`. `LiveEffects.js:168-170`: `expiresAt = … GameClock.now() + durationMs`; `:554`: `const now = GameClock.now(); for (const bearer of allBearers()) tickBearer(bearer, fire, now)`. `SpriteLayer.js:527-531,553`: absorb and age compare `now - sprite.bornAt`. `RulesUseGameClock.test.js` exists and lists who may use `Date.now()` (ids, save stamps, drawing), which is the convention this finding leans on.
- **Fix sketch**: Make live `now()` monotonic but epoch-shaped: on `GameLoop.start()` (and when a catch-up ends) anchor `liveBaseEpoch = Date.now(); liveBasePerf = performance.now()`, and return `liveBaseEpoch + (performance.now() - liveBasePerf)` in live play. Saved stamps (`expiresAt`, `bornAt`) stay epoch numbers, so loading and the catch-up's `GameClock.begin(savedAt)` are unchanged. Must not change: the bench's identity gate (S8 = S8L; the bench puts its own virtual clock in place, `bench/README.md` "Catch-up timing"), `RulesUseGameClock.test.js`'s allow-list, and ids and save stamps (which keep `Date.now()`). Fix the `TimeManager.js:29-31` comment in the same slice. **Hypothesis to test**: in a dev build with a status on a hero, set the PC clock forward one hour: today the status ends at the next rules tick; after the fix it runs its course.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. GameClock.js:18 as quoted; every cited reader checked for its stated purpose; TimeManager.js:29-31 lists DST; RulesUseGameClock.test.js has an ALLOWED map of Date.now users; the full Date.now grep over src/systems outside tests shows only ids, stamps, drawing and real-time uses beyond the listed rules.
- **State**: ticket T-358 (triaged 2026-11-07)

### CR4-016  Every quiet gap of one second or more restarts the loop's timer and resets the whole screen
- **Tag**: perf
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: reasoned (no number: the soak ran in headless Chrome, which did not throttle the hidden page)
- **Where**: `src/systems/core/CatchUp.js:111-116` (the short-gap path: `run({ …, sliceMs: Infinity, save: false })` with `reset` left at its default `true`), `:322-323,366` (`run` stops and restarts the loop), `:383-388` (`GAME_RESET`, `HEROES_UPDATED`, `INVENTORY_UPDATED` at the end), `src/systems/core/GameLoop.js:25-52` (`start`/`stop` each log a line; `start` re-arms `TimeManager`)
- **What**: When a tick finds between 1 s and 2 min of undelivered time, the catch-up plays it synchronously inside that tick. That path inherits the long-gap defaults: it stops the loop (clearing the interval), re-creates the interval in `finally`, logs "Stopped" and "Started", subscribes and unsubscribes the nine summary listeners and the four news listeners, and ends by publishing `GAME_RESET` plus the two broad updates, which every surface listens to (3 direct subscriptions and the `useGameState` hooks that list it; 25 UI files outside tests name it). In a browser tab that Chrome throttles to one timer a minute (its intensive throttling after 5 minutes hidden), each wake delivers one tick with ~59 s of overflow, so every minute in the background the game plays a quiet 59-step catch-up and then re-renders everything. The screen is hidden, so the player sees nothing; the cost is CPU and churn while hidden, which is R11's territory (the hidden-phase growth in `baseline/soak.txt` was measured without throttling, so it is not this). A sleeping-tab wake with a 1.5 s hitch takes the same path for one step.
- **Evidence**: `CatchUp.js:116`: `run({ savedAt: start, now: start + play, sliceMs: Infinity, save: false });` (no `reset: false`, no `news: false`); `:322-323`: `const wasLooping = GameLoop.getIsRunning(); if (wasLooping) GameLoop.stop();`; `:366`: `if (wasLooping) GameLoop.start();`; `:383-388` as cited; `GameLoop.js:36,51` the two `logger.info` lines. `grep -rln GAME_RESET src/ui` outside tests: 25 files (the verifier's count; an earlier grep of several event names together gave 32).
- **Fix sketch**: Keep the design (quiet play, then one reset: the UI did miss those steps, so a reset is honest) but make the short path cheap: pass `news: false` when `play < SHOW_GAP_MS` only if the news is not wanted for short gaps (check with the owner: a Bank-full banner from a 30 s gap is probably still wanted, so likely keep news), and skip the stop/start pair for a synchronous run (`sliceMs === Infinity` never yields, so the loop cannot tick meanwhile; `GameLoop.start()`'s `TimeManager.init()` is then also skipped, which is correct because the tick already measured). Also add a `.catch` to the synchronous `run(...)` call at `:116`: `run` is `async`, so a throw inside becomes an unhandled rejection rather than reaching `onOverflow`'s caller. Must not change: the bench identity gate; the long-gap path; `GAME_RESET` at the end of a quiet run. **Hypothesis to test** (R11, or a dev build): hide a tab for 10 minutes with `Game.EventBus.setLogging(true)`; expect one `catch_up_finished` and one `game_reset` a minute after the fifth minute. If the desktop (Tauri/WebView2) build does not throttle a minimised window (the soak suggests headless Chrome does not), this costs the shipped game nothing and the finding closes as moot for the desktop.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed after one correction (25 UI files outside tests name GAME_RESET, not 32; fixed above). Read CatchUp.js:111-116, :322-323, :366, :385-387, GameLoop.js:36,51 and TimeManager.init; counted 9 summary and 4 news subscriptions; confirmed the synchronous completion with sliceMs Infinity (the break at :350 fires before the await; play is a multiple of STEP_MS) and that the long-gap caller has a .catch while the short-gap one does not.
- **State**: ticket T-356 (triaged 2026-11-07)

### CR4-017  A handler that throws is logged ten times a second with no throttle
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/core/GameLoop.js:89-95` (`runHandlers`: `try { handler(delta, tickCount) } catch (error) { console.error(…) }`), `src/systems/core/EventBus.js:100-106` (the same shape per subscriber per publish)
- **What**: The loop and the bus both do the right thing on an exception: catch it so one bad handler cannot stop the game, and log it. Neither remembers that it already logged the same failure, so a handler that fails on every tick (a bad hero record in `RegenSystem`, which its own comment at `RegenSystem.js:44-46` worries about) writes 600 identical stack traces a minute to the console, 36,000 an hour, and the catch-up's 86,400 steps would write 86,400. In a dev build that makes the console unusable at the moment it is needed; in the shipped build it is memory held by the devtools buffer when open and otherwise wasted work. The player sees nothing either way.
- **Evidence**: `GameLoop.js:90-94` and `EventBus.js:101-105` as cited: a bare `console.error` in each `catch`, no counter, no `Set` of seen names.
- **Fix sketch**: Keep a `Map<name, count>` per handler (and per event name on the bus): log the first error with its stack, then every 100th (or once a minute) as "still failing, N times". A builder-lite slice with a test that throws from a registered handler 50 times and expects two log lines. Must not change: that a throwing handler never stops the other handlers or the loop (the `try/catch` per handler stays).
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. Both catch blocks are a bare console.error; a grep for count, throttle, dedupe or lastError in the two files finds nothing relevant; RegenSystem.js:44-46 is the quoted comment.
- **State**: ticket T-356 (triaged 2026-11-07)

---

## Notes (no `path:line` of their own, or another area's)

- **Verified sound, not findings.** `TimeManager.update` floors at 0 before clamping, so a backward `performance.now()` step (impossible in practice) neither delivers a negative delta nor subtracts from the overflow. `GameLoop.tick` returns after `TIME_OVERFLOW` if the catch-up stopped the loop, so the tick's own step is not played twice. `CatchUp.onOverflow` keeps the sub-second remainder (`pendingMs % STEP_MS`) for the next gap and the long-gap `savedAt` includes the tick's own delta, so no time is lost or doubled. `EventBus.setQuiet` keeps a second `Map` of engine-only listeners so a quiet publish costs one lookup, not a filter. The `quest_manager` after `board_runner` order is pinned by `TickHandlerOrder.test.js`.
- **For R2 (board).** `SpriteLayer.tick` (`SpriteLayer.js:518-556`) copies the sprite list (`[...list]`) once or twice per tick and reads `SettingsManager.get` by string path two to four times per tick; with 40 floor stacks that is small, but it runs even when nothing can absorb or expire. A `dirty` flag or a next-due time would skip most ticks.
- **For R3 (heroes).** `RegenSystem.tick` (`RegenSystem.js:23-64`) calls `ConsumptionSystem.tryEat(hero.id)` for every idle or working hero every tick, which looks the hero up again and returns a fresh array (`ConsumptionSystem.js:89-94`); `WoundedSystem.tick` builds a new filtered array per tick (`getHeroesByStatus`). Both are tiny at roster sizes of 5 to 10; note them only if R3's profile shows hero code in the per-tick top ten. `RegenSystem` publishes `HEROES_UPDATED` on every tick in which any hero gained HP (every `REGEN_CONFIG.hp.interval`), which R5 should count against the dock's renders.
- **For R5 (React plumbing).** `GAME_RESET` is named by 25 UI files outside tests; CR4-016 says when the engine publishes it unexpectedly. The three catch-up events are the only ones delivered to UI listeners while the bus is quiet (`HEARD_WHILE_QUIET`, `engineEvents.js:193`).
- **For R6 (saves).** `CatchUp.run` keeps the whole pre-catch-up save as a JSON string (`keep`, `CatchUp.js:315-318,378`) for "Load as I left it" until the summary closes (`CatchUpOverlay.jsx:57` → `forgetUndo`); for a load it is the text the load read (`takeLoadedJson`), for a live gap it is a fresh `serializeJson()`. One save's worth of memory, released on close: by design.
- **For R11 (memory, idle).** The soak's hidden phase ran with the tick at 10 a second (no throttling in headless Chrome), so CR4-016's path did not run there; the 294 nodes a minute are something the drawing side does while hidden, not the loop. If a soak is ever run in the real desktop shell, log `catch_up_finished` to see whether WebView2 throttles a minimised window.
- **Dev only, not filed.** `DevTools.advanceTime` runs up to 7,200 synchronous steps without moving `GameClock`, so statuses do not expire and rate windows do not move during a dev skip; its own comment says so (`DevTools.js:70-73`). A QA convenience, not a player path.
- **EventBus semantics worth knowing.** `Set.forEach` visits a listener added during the same publish and skips one removed during it; nothing in `src` relies on either today, but it is the kind of thing a future "subscribe inside a handler" would trip on.
