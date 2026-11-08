# Brief 520 measurements, 2026-11-08

Taken by the director in the night window of 2026-11-08, 01:45 to 06:00 Vancouver time (the PC's clock
reads an hour ahead: 02:45 to 07:00). Machine quiet: the owner's dev server stopped at 01:36 and no agent ran
beside the benches. Machine and conditions as in `docs/reference/PERFORMANCE.md` (i7-8700, RTX 3060,
Node 24.11.1, headless Chrome 156). Numbers are this PC's only. Which tickets each number decides:
`docs/active/briefs/520_review_measurements.md`; the tickets' new states are in `docs/reference/TICKETS.md`.

## The measurements

| # | Number | Scenario | Commit | Machine |
|---|---|---|---|---|
| M1 | **24 h catch-up: 33.1 s wall, 0.383 ms a step** (1 h 1.8 s, 6 h 9.8 s); target under 30 s | `node --cpu-prof bench/catchup/time.mjs --hours=1,6,24`, S2, 1000 ms steps, seed 1, under the profiler (the profiler adds its own cost, so the unprofiled time is lower) | `main` 13c542cd (T-078's loadout memo merged) | quiet |
| M1 | **Where the catch-up's CPU goes**: the ranked list below. GC 0.8 % of busy time | the same run's main-thread profile (35.2 s busy, covering the 1 h, 6 h and 24 h runs in one process) | 13c542cd | quiet |
| M1 | **C240: p50 0.553 ms, p95 0.795, p99 7.801, max 20.95**, mean 0.813, 238 Tokens, same work | `npm run bench -- --only=C240 --cpu-prof` | 13c542cd | quiet |
| M1 | **C240's cost is placing new spawns on a near-full mat**: `MatPlacement.forceSpot` 18.0 % of the profile's busy time (about 31 % of the tick handlers' time), every sample of it under `EffectActions.spawnPoint` from `SpawnerSystem.tryToSpawn` (T-326's re-search); the room search T-345 names (`Placement.hasRoomForProduct` to `findSpotAnywhere`) has **no samples** on C240 or in the catch-up | the C240 timing and profile runs' `.cpuprofile` (`bench/results/prof/C240-*`) | 13c542cd | quiet |
| M2 | **Not measured.** `bench:draw` prints no ground build numbers (no plan or screen build marks); wiring them into the draw bench is part of T-352 itself | `npm run bench:draw -- --compare` | 3e1f50f5 | quiet |
| M3 | **Hero dock to mat drag, 1×: carry frames over 16.7 ms 2 of 2,579 (plain) and 4 of 2,523 (speech bubbles re-raised)**; median drag's longest carry frame 6 ms and 12 ms, longest 24 ms. Pickup: 42 and 46 frames over 16.7 ms of about 1,215, median drag's longest 18 ms. Drop: 21 and 37 of about 2,400, median longest 12 and 18 ms. Success 46/50 in both passes (4 drops each "the hero has no flag") | `npm run bench:drag -- --kinds=dockHero`, S2, perf build | 13c542cd | quiet |
| M3 | **The 20 s DevTools pointer-move trace was not taken** (no `updateAlphaPointerEvents` self time, no 4× carry) | | | |
| M4 | **0.46 commits and 4.80 renders a tick**, React 1.19 ms render time a tick (dev build), React scheduler 1.48 ms a tick; the mat (`MatBoard2`) woke 0.10 commits a tick carrying 1.61 renders and 0.62 ms (over half of React's time); `HeroBubbleLayer` 0.11 commits, `ItemStubColumn2` 0.06. UI listeners 0.10 ms a tick, the largest `board:progress` 0.018 ms; `heroes_updated` is not among the eight largest (each 0.004 ms or more) | `node bench/tick-commits.mjs`, S2 realistic, seed 1, 600 ticks, dev build | 13c542cd | quiet |
| M5 | **Hidden 20 min on `main`: T-333 still fails.** Hidden slopes: DOM nodes +269 a minute, listeners +88.5, heap +86.5 KB; all released on the first visible frame. The hidden snapshot holds 1,552 `KeyframeEffect`s and 2,615 detached `<span>`s (one-shot effects never finished) | `npm run bench:soak -- --hidden=20 --snapshot --compare`, cap128 | 13c542cd | quiet |
| M5 | **Hidden 20 min with the second pass: nodes −0.07 a minute, listeners −0.02**, heap +46.8 KB a minute (freed on show); "the hidden phase behaved". What remains in the hidden snapshot is 128 `CSSTransition`s and their keyframes: the heroes' walking glide (new ticket T-389) | the same command | `fix/hidden-fx-2` b661af44 | quiet |
| M5 | **Visible idle, cap128: page task time 156 to 168 ms a second** (10 min run); style passes 118 and 122 a second, layouts 6.8 to 7.0 a second, script 18 ms a second (the visible phases of the two hidden soaks) | `npm run bench:soak -- --minutes=10 --hidden=0 --compare` and the hidden soaks' phase tables | 13c542cd, b661af44 | quiet |
| M5 | **60 min readable build: heap +20.4 KB a minute over 55 fitted minutes (r² 0.78)**: 49 KB a minute from 5 to 29 min, **5.8 KB a minute from 30 to 60 min** (levels off near 18.3 MB). Nodes, listeners, bus subscribers and documents flat. Class diff (5 to 60 min): compiled code +1.18 MB (+2,256), closures +1.09 MB retained on **−7** objects, scope contexts +0.56 MB on −11, then Blink style caches (`PresentationAttributeCacheEntry` 105 → 915, `CSSRatioValue` 206 → 1,826, `CSSValueList` +1,700, `ImmutableCSSPropertyValueSet` +810); plain `Object`s −35 | `npm run bench:soak -- --minutes=60 --hidden=0 --readable --snapshot` | 13c542cd | quiet |
| M6 | **Save on cap128 (one Region): 37 KB (37.8 to 38.3 K characters), `GameState.serializeJson` 0.2 to 0.4 ms** (median of 5), four soaks | the soaks' end-of-run line | 13c542cd, b661af44 | quiet |
| M6 | **Pending**: the owner's slot (a copy) and cap128 with six Regions | | | |
| M6 | **Pending**: `Atlas.settle` and `worldView()` in a quiet window. A smoke on a busy machine read settle 5.2 to 6.5 ms and worldView 1.2 to 1.6 ms (not a measurement) | `npm run bench:micro -- bench/micro/atlasWorld.bench.js` | | busy (smoke) |
| M7 | **Pending**: the desktop app minimised ten minutes, by hand | | | |
| M8 | **Boot, perf build from local files, 1×: page ready 166 to 192 ms, engine init 191 to 219, art ready 458 to 546, React mounted +1 ms after art, splash gone 876 to 1,141** (S3's runs the latest). **4×: page ready 532 to 613, engine init 668 to 742, art ready 1,303 to 1,407, splash gone 2,041 to 2,247.** The art preload (engine init to art ready) is about 300 ms of about 900 at 1× and about 650 of about 2,100 at 4×. Cold and warm were not separated: the night's first page load (S1 1/2, 488 ms to art ready) is no slower than the later ones. No network-throttled run | `npm run bench:draw -- --compare`, boot marks per run (16 runs per condition) | cleanup 3e1f50f5 | quiet |
| M9 | **The suite is green under `FG_TEST_SEED=b`: 632 files**, run on 7 Nov during brief 510 F2 (T-340 closed with it) | `FG_TEST_SEED=b npx vitest run` | `fix/farming-seed-test` 738a3af1 | quiet |

**The draw bench's verdicts.** The same `bench:draw --compare` run read REGRESSED on the 1× work p99 of every S2
scene and S3 (S2 8.1 ms against the 7 Nov baseline's 2.6; S3 13.4 against 5.5, and S3's in-budget share 94.0 %
against 99.4 %); every 4× number was ok, most better. The director checked with alternating runs of the
baseline commit 85cefe1f, `main` and the cleanup: all three measure the same (S2 p99 about 3.3 to 4.6 ms, S3 about
10.3 to 12.4, Bank about 6.1 to 7.5), so the 7 Nov draw baseline was a lucky run. **Retake the draw baseline in
the next quiet window.**

## Where the 24 h catch-up's CPU goes

Shares of the main thread's busy time (35.2 s) in the M1 profile. *Inclusive* counts everything a function
calls; *self* counts only its own lines. The engine's tick handlers are 92.8 % inclusive; the rest is the bench's
start-up (Vite, module loading). Ticket numbers mark the rows a ticket covers.

| Rank | Where | Inclusive | Self | Ticket |
|---|---|---|---|---|
| 1 | `TimedChanges.tick` (timed rules, spawns, regrowth): of it `advance` 7.5 % (self 1.2 %), `fire` to spawns 4.3 %, `activeHandlers` 1.0 % | 18.0 % | 3.9 % | T-346 (part) |
| 2 | `Flags.assign` (heroes choosing work): `choose` 10.6 %, `keepOrRelease` 3.1 %; most of `choose` is `Flags.evaluate` to `Camps.campWork` (9.7 %, with `isCampWork` 6.8 %, `isEnemyCamp` 2.7 %) | 15.0 % | 0.5 % | none |
| 3 | `BoardRunner.tick`'s own per-Token pass | (82.1 % with everything below it) | 12.3 % | none |
| 4 | `EventBus.publish` to listeners: `TriggerSystem` 3.8 %, `QuestManager` about 3.9 %, `BoardRunner` 1.0 %, `TileModifiers` 0.7 % | 10.4 % | 0.3 % | T-346 (triggers) |
| 5 | `BoardCombat.tickToken` (fights): `processCombat` 2.8 %, `resolveVictory` 2.3 %, the progress publish 0.3 %, the enemy's stat block (`enemyFor`) 0.3 % | 6.0 % | 0.3 % | T-347 (0.6 %) |
| 6 | `BoardRunner.completeCycle` | 5.9 % | 0.4 % | none |
| 7 | `QuestTokens.questTokens` (a scan of the mat for quest Tokens on every progress report and bounty tick) | 5.2 % | 4.3 % | none |
| 8 | `WorkCheck.fixableReason` (the per-tick "may this cycle still run"): of it `Charges.planCycle` 3.3 %, `planContextCharges` 2.8 % (`contextProvidersAround` 2.5 %) | 5.1 % | 1.0 % | T-346 (CR4-020) |
| 9 | `BoardState.workerOf` | 4.6 % | 0.7 % | none |
| 10 | `HeroMotion.tick` (`step` 3.2 %, `destinationOf` 0.5 % self) | 4.2 % | 0.4 % | T-346 (Hall scan, small) |
| 11 | `SpawnerSystem.syncAlerts` 3.4 % and `ensureCensus` 1.7 % | 5.1 % | 1.6 % | T-346 (census: 1.7 %) |
| 12 | `TileModifiers.resolveAxis` 3.4 % / `workTimeOf` 2.8 % | 3.4 % | 0.5 % | none (T-078 merged) |
| 13 | `BoardState.heroOfInstance` | 3.3 % | 2.7 % | none |
| 14 | `TriggerSystem.handleNearby` (+ `handleGlobalItemThreshold` 0.2 %) | 3.0 % | 1.5 % | T-346 (CR4-023) |
| 15 | `BlockUpkeep.tickUpkeep` (`costedStatements` 0.7 %) | 0.9 % | 0.2 % | T-346 (CR4-021) |
| 16 | `HeroEffects.loadoutStatements` (after the T-078 memo) | 1.3 % | 0.5 % | closed (T-078) |

**What the findings expected and did not find.** The room search (`hasRoomForProduct`, `findSpotAnywhere`):
no samples (neither board has a station held at no room or a blocked Foundation). The recipe pool
(`recipesForStation`, `skillRecipes`): 0.06 % inclusive. Neighbour tags (`getProvidedTagsWithTiers`) 0.05 %,
`contextTiersAround` none, the floor count (`SpriteLayer.countOnBoard`) 0.02 %. The swung weapon
(`getHeroWeapon`, `getHeroWeaponSlot`) 0.1 %. `SkillSystem.addXP` 0.4 % and `RegenSystem.tick` 0.5 % in all
(their whole work, not just the `HEROES_UPDATED` publish). Garbage collection 0.8 %, so allocation churn is not
a cost here.

**The largest costs no ticket covers**: heroes choosing work through the camp checks (rank 2, 15 %), the quest
Token scan (rank 7, 5 %), `workerOf` and `heroOfInstance` (8 %), and the spawner alert sweep (3.4 %).
