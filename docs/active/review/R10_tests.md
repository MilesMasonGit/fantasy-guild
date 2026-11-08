# R10: Tests

Read 2026-11-07 on `main` 1410f15e (reviewer, Fable 5.1; two full suite runs with the JSON
reporter, one at the default seed and one under `FG_TEST_SEED=b`, both while two read-only agents
ran beside them, so the times are indicative; two Sonnet verifiers). Area per the concept doc:
`src/tests` (632 files, 7,880 tests); the questions are slow files, tests that test nothing,
duplicated fixtures, and flakiness under seeds.

## Summary for the owner

**What this area does for the player.** Nothing directly: the tests are the net under every
change. For the owner they are the first line of the merge gate and the three and a half minutes
every fix waits.

**How healthy it is: strong, and one test relies on luck.** 7,875 tests pass at the default seed
and 7,874 under a second seed: exactly one test depends on the dice, and the seeding harness the
project built is what let a two-run check find it. No test is empty, none asserts a constant, the
two skipped tests are marked as content drift, and the suite's own guards (a subscriber that
throws fails the test, the tether census is checked after every test) are the kind other projects
do not have. The costs are time and shape: half the suite's time is in thirty files, a quarter of
it is the CMS's own tests, fifty-seven files boot a browser environment they do not use, and the
same three fixture helpers are written out by hand in forty-six, twenty-five and twenty files.

**The three findings that matter most.**
1. **One test relies on luck** (CR4-087): under another seed the farming harvest test expects
   one wheat and gets two. The convention is that a luck-dependent test fails every time or never;
   this one fails under seed `b`.
2. **Half the suite's time is thirty files, and the slowest are seed sweeps** (CR4-088): 3,000
   world seeds, 40 settled worlds, every shipped enemy's preview, and three tests that spawn a
   second Vite or a command line; 126 tests take over a second, 11 over five.
3. **Fifty-seven files ask for the browser environment and never touch a document** (CR4-089):
   they need only `localStorage`; the environment's start-up is the largest single line in the
   suite's own time report.

**Counts.** 5 findings: 1 `test` (the luck), 2 `perf` (measured), 1 `cleanup`, 1 `docs`;
0 `owner-decision`. Verified: see each finding's `Verified by`.

**Measure first.** Already measured here (two runs). A third run under `FG_TEST_SEED=c` would say
whether CR4-087 is the only one.

---

## Findings

### CR4-087  One test depends on the dice: under a second seed the farmer harvests two wheat, not one
- **Tag**: test
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/tests/FarmingHarvest.test.js:185-200` (the test "the last harvest can pay with the seed it dropped itself", `expect(wheat()).toBe(1)` at `:195`; vitest reports the failure at `:193`); the run: `FG_TEST_SEED=b npx vitest run` at 1410f15e, "7,874 passed, 1 failed: `AssertionError: expected 2 to be 1`"; the default seed passes it; the file seeds nothing by hand (`grep -n "Math.random\|setRandomForTests\|spyOn(Math" src/tests/FarmingHarvest.test.js`: none); the convention: `docs/reference/TESTING.md:44-52` ("A luck-dependent test now fails every time or never; to hunt for one, run the suite under other seeds") and `src/tests/setup/seededRandom.js:1-9`
- **What**: The suite replaces `Math.random` with a seeded generator rewound per test, so a test that depends on luck is deterministic at the default seed and the only way to find one is to change the seed. Under the second seed, one of 7,880 tests fails: the farming harvest test expects the last cycle to pay one wheat and gets two, so somewhere between the harvest roll and the sowing the number of wheat depends on a draw the test does not pin. Either the test should pin the roll (seed by hand, or assert a range) or the harvest's quantity should not be random where the test says it is fixed: that is the farming engine's question (R2's area), and the test is what will tell.
- **Evidence**: the two JSON reports in this session's scratch folder (`vitest.json`, `vitest_seed_b.json`); the gate (`TESTING.md:5-9`) runs the default seed only.
- **Fix sketch**: Read the harvest path for the draw (`Fields.js`, the harvest cycle's output roll) and decide: if the quantity is meant to vary, the test asserts `>= 1` or pins `Math.random` for that cycle; if it is meant to be fixed, the engine is wrong. Then add a second-seed run to the gate's description (not the default run: it doubles the time) or to the nightly bench window, since the harness already supports it. Must not change: the harvest's design (the owner's); the default seed.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed from both JSON reports (seed b: 7,874 passed, 1 failed "expected 2 to be 1" in `FarmingHarvest.test.js`; default seed: 0 failed); the file seeds nothing by hand; `TESTING.md:5-9,44-52` as described. The test's title corrected.
- **State**: ticket T-340 (triaged 2026-11-07)

### CR4-088  Half the suite's time is thirty files, and the slowest are seed sweeps and spawned processes
- **Tag**: perf
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: measured
- **Where**: the default-seed JSON run at 1410f15e: 632 files, 7,880 tests, 265 s wall (the baseline, `baseline/suite.txt`, is 203 s on a quiet machine; this run shared the machine with two agents), 705 s of summed file time; the thirty slowest files hold 46 % of it: `WorldGeneration.test.js` 31.1 s (35 tests; "3000 seeds, strict rings" 11.9 s, "500 seeds with the wild ring" 5.5 s), `WorldSettleCeremony.test.js` 29.8 s ("every enemy can be reached over 40 worlds" 17.6 s, "the arrival stands spread out" 8.0 s), `CMSLedgerGate.test.js` 16.3 s ("the gate command exits 0 … and 1" 12.4 s: it spawns the command line), `GroundOnMat.test.js` 15.9 s ("one ground pixel is a whole number of Token pixels" 9.5 s), `RulesLine.test.js` 15.6 s, `TerrainGrass.test.js` 14.8 s, `CMSLedgerPage.test.js` 12.9 s, `CatchUpNews.test.js` 12.0 s ("hearing the news changes nothing" 5.0 s), `StyleSheetPage.test.js` 12.0 s, `EncyclopediaScreen.test.js` 11.4 s, `WorldMap.test.js` 11.3 s, `CMSEnemyHostile.test.js` 9.5 s ("the level preview for every shipped enemy" 7.3 s), `CMSCli.test.js` 8.1 s ("the real entry point runs through Vite" 6.1 s), `FightStepFidelity.test.js` 8.0 s ("an hour of crowded fights", once per step size, 5.4 s for the 100 ms ticks); 126 tests over 1 s, 11 over 5 s; the 61 `CMS*.test.js` files take 175 s of the 705 s (25 %); `WorldGeneration.test.js` sweeps `3000` seeds by name
- **What**: The suite is long because a few tests do a lot by design: sweeps over thousands of world seeds, forty settled worlds, every shipped enemy, an hour of fights in two step sizes, and three tests that start a second Vite or spawn the CMS's command line. They are the guarantees the world and the ledger rest on, and they belong in the suite; they do not all belong in the three-and-a-half-minute run every fix waits for. The CMS's own 61 files are a quarter of the time and test an app the game's gate does not ship.
- **Evidence**: the JSON reports as cited; `baseline/suite.txt` ("transform 39.8 s, setup 25.5 s, import 538 s, tests 500 s, environment 842 s (summed across workers)"; "the CMS-only files (63) take 48 s alone").
- **Fix sketch**: Two vitest projects (or a `--project` flag): `quick` (the gate: every file, but the sweeps at their small counts, e.g. 300 seeds and 8 worlds, read from an env var the sweep tests already accept, `FG_SWEEP=full`) and `full` (the sweeps at 3,000 and 40, the CMS, the spawned-process tests), with `full` run in the bench window beside `bench:soak`. Must not change: any assertion; the sweeps' full counts in the full run; the merge gate's rule that nothing red merges. **Hypothesis to test**: the `quick` run's wall time on the quiet machine against the 203 s baseline.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed from the JSON report: 632 files, 7,880 tests, 264.6 s wall, 704.6 s summed, the thirty slowest 325.3 s (46.2 %), 126 tests over 1 s and 11 over 5 s, the 61 CMS files 175.4 s, every quoted file and test time within rounding; the seed-b run took 238 s wall. `suite.txt`'s import and environment lines confirmed.
- **State**: ticket T-357 (triaged 2026-11-07)

### CR4-089  Fifty-seven files ask for the browser environment and never touch a document
- **Tag**: perf
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: measured
- **Where**: `grep -rl "@vitest-environment jsdom" src/tests`: 288 of 632 files; of those, 57 contain no `render(`, `document.`, `window.`, `screen.`, `fireEvent`, `querySelector` or `createElement` (the first thirty: `AssetManager`, `AudioSystem`, `BenchFights`, `CampsCatchUp`, `CatchUpNews`, `CatchUpOnLoad`, `CMSEconomyCutover`, `CMSLedgerPlan`, `CMSRecalculateWorkspace`, `CombatCatchUp`, `CombatCatchUpEncounters`, `CombatCatchUpGear`, `CombatCatchUpStatuses`, `CombatEvenStart`, `DamageTypesCatchUp`, `DrawersExclusive`, `DropLapCatchUp`, `EnemyMovesCatchUp`, `FarmingCatchUp`, `FightStepCatchUp`, `FightStepCrowd`, `FightStepFidelity`, `FishingCatchUp`, `FlagReachRing`, `ForestryCatchUp`, `FrameClock`, `FreeMatStorage`, `GearDefenceCatchUp`, `HeroBarBubblesCatchUp`, `HeroCamps` `.test.js`); why they ask: `src/systems/core/SettingsManager.js:104-106` (`localStorage.getItem` in `load()`, called by `init()`) and `src/systems/core/SaveManager.js:133` (`sessionStorage.getItem` in `init()`), which `EngineBootstrap` runs; under the node environment both throw; the cost: `baseline/suite.txt` ("environment 842 s (summed across workers)", the largest line of vitest's own breakdown, against "tests 500 s"), `vitest.config.js:40-41` ("Node by default; files that need the DOM opt in")
- **What**: Nearly half the suite boots a simulated browser, and about a fifth of those files use none of it: they are engine tests (the catch-up family above all) that need `localStorage` and `sessionStorage` because the settings and save managers read them at init. jsdom's start-up is the biggest single line in the suite's time report. A storage shim in a setup file (two in-memory `Storage` objects on `globalThis` when none exists) would let these files run under node, which starts in a fraction of the time, and would make the opt-in comment at the top of the config true again.
- **Evidence**: As cited; the count is by grep and each of the 57 needs a try (a module they import may read the DOM at init in a way the grep misses: `AudioSystem` creates `Audio` elements).
- **Fix sketch**: A `src/tests/setup/storageShim.js` that installs minimal `localStorage`/`sessionStorage` when `globalThis.localStorage` is undefined; then drop the `jsdom` docblock from the 57 files one at a time, keeping it where the file fails under node. Must not change: any assertion; the five existing setup files' order (`seededRandom.js` must stay first). **Hypothesis to test**: the suite's `environment` line and wall time, before and after.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed: 288 jsdom files, 57 with none of the DOM markers by the same grep; `SettingsManager.js:104-106` and `SaveManager.js:133` read storage; `vitest.config.js:40-41` as quoted. Not checked by the verifier: that `init()` calls `load()` (it does, `SettingsManager.js:95`).
- **State**: ticket T-357 (triaged 2026-11-07)

### CR4-090  Three fixture helpers are written out by hand in 46, 25 and 20 files; 39 guard tests read the source tree; 41 files wait on real timers
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: verified
- **Where**: `grep -rn "^function makeHero\|^const makeHero" src/tests/*.test.js`: 46 files, in two shapes (a skills map at a level, e.g. `AcceptedTokens.test.js:22-24`, `AdjacencyEffects.test.js:44-46`, `ChargesEngine.test.js:32-34`; `generateHero` with an id, e.g. `BoardCombat.test.js:67-69`, `CarriedTokenPause.test.js:47-49`, `CombatEngaged.test.js:48-50`); `newGame` 25 files (`AtlasMapPreview.test.js:80`, `AtlasRegions.test.js:39`, `AtlasSettle.test.js:108`, `CarryStaysOnItsBoard.test.js:44`, …); `buildBoard` 20; `loadShipped` 12; against `src/tests/fixtures/` (28 files; `mat.js` is imported by 108 files and exports `SPACING`, `placeAt`, `row`, `beside`, `clearMat`: no hero or new-game helper exists); the guard tests: about 39 files read the game's source as text (`fixtures/sourceScan.js` imported by 29; the rest by their own `readFileSync` of `src/` or `cms/`, a count that depends on the pattern: `ContentIdsInCode`, `DeadEventWiring`, `EngineEventNames`, `UiEventOwnership`, `TextInCodeMatchesScreen`, `PlainWords`, …), each walking the tree once per file (`sourceScan.js:6-9`); real waits: 41 files mention `setTimeout`, about 24 of them `await` a real one with no fake clock, `DragSharedSource.test.js` nine times (8.0 s), `SaveFilesCatchUp`, `OrderDragLine`, `MatPressTarget`, `CombatScreen` three each; 70 files use fake timers; 6 read `Date.now()` with no fake clock (`BenchHygiene`, `CMSChangePackWorkspace`, `EconSimAdversarial`, `EconSimRunner`, `SpriteLayerAbsorption`, `TitleScreen`); the two `it.skip` (`ContentRules.test.js:208,239`) against the convention that content drift is `it.fails` (`TESTING.md:5-7`)
- **What**: The fixtures folder is good where it exists (the mat helpers are in 107 files) and missing where the tests needed it most: forty-six files make a hero by hand in two different shapes, twenty-five start a game by hand, twenty build a board by hand. When the hero shape changes (R6's CR4-067 will), forty-six files change. The 39 guard tests are a project strength (they are how the review's own rules stay true), and a cost: a tree walk per guard file per run and a brittleness to file moves (R0's CR4-003 would move 4,262 lines). The real-timer waits are where the suite is slowest per assertion and where a slow machine makes a test flaky; `DragSharedSource` is the file to start with.
- **Evidence**: grep counts as cited.
- **Fix sketch**: Add `fixtures/heroes.js` (`makeHero(id, { level, hp, style })` covering both shapes) and `fixtures/game.js` (`newGame`, `buildBoard`, `loadShipped`), then replace the local copies file by file (a builder-lite slice per ten files); give the guard tests one shared, cached tree walk per worker (vitest's `globalSetup` or a file-level cache keyed by `SRC`); replace the real waits with fake timers where the awaited thing is a timer, keeping the few that wait on a real microtask queue; mark the two `it.skip` as `it.fails` with the content note. Must not change: any assertion's meaning; the guard tests' coverage.
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. The 46/25/20/12 local helpers, the `mat.js` exports, the 29 `sourceScan` importers, the six `Date.now()` files and the two `it.skip` lines confirmed. Corrected: `mat.js` also exports `SPACING` and is imported by 108 files; 70 files use fake timers; of the 41 files mentioning `setTimeout` about 24 await a real one (17 also use fake timers); `DragSharedSource` waits nine times; the guard-test count depends on the grep pattern (29 are certain).
- **State**: ticket T-357 (triaged 2026-11-07)

### CR4-091  Docs: the testing guide is right; the seed check it describes is not in the gate
- **Tag**: docs
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `docs/reference/TESTING.md:5-9` (the gate: "`npm test` shows no new failures"; the suite "takes ~2–3 minutes": 203 s quiet, 265 s loaded today), `:44-52` (the seeded tests and the second-seed hunt, described as something to do by hand: CR4-087 is what it finds), `:7` ("today no plain red test remains": true at both seeds but one); `vitest.config.js:40-41` ("Node by default; files that need the DOM opt in": 288 of 632 opt in, 57 without need, CR4-089); `docs/reference/ARCHITECTURE.md:529-531` (the measurement table lists the benches and `tick-commits`, not the suite's own timing report); `docs/active/concept_code_review_2026.md:92` ("627 files, about 7,350 tests, 2 to 3 min": 632 files, 7,880 tests today)
- **What**: The testing guide describes the suite accurately and tells the reader how to hunt a luck-dependent test; nobody had run that hunt until today, which is a process note for the director (a second-seed run in the bench window), not a doc defect. The concept doc's counts are a week old.
- **Evidence**: As cited.
- **Fix sketch**: Add the second-seed run to the bench window's routine in `TESTING.md` and the director's checklist; refresh the counts. Must not change: nothing in code.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed (`TESTING.md:5-9,44-52,7`; the concept doc's 627/7,350 against 632/7,880 today). `ARCHITECTURE.md:529-531` not re-read by the verifier.
- **State**: ticket T-382 (triaged 2026-11-07)

---

## Notes (no `path:line` of their own, or another area's)

- **Tests that test nothing: none found.** Every test file has at least one `expect(`; there is no `expect(true)` or `expect(1).toBe(1)`; 72 assertions across the suite are the weak kind (`toBeDefined()`, `not.toThrow()`), under one per hundred, and most sit beside stronger ones. The two skipped tests are content drift, documented in place.
- **The suite's own guards, checked.** `setup/eventBusErrors.js` fails any test in which a bus subscriber threw (`ALLOWED` is empty: no exceptions today); `setup/tetherCensusCheck.js` compares the spawner census with a walk of the mat after every test; `setup/seededRandom.js` rewinds `Math.random` per test from a hash of the test's name, so adding a test never shifts another's numbers; `setup/instantArrival.js` and `quietLogger.js` keep the runs fast and quiet. These are why the one luck-dependent test could be found in two runs.
- **Both runs green otherwise.** Default seed: 7,875 passed, 0 failed, 5 skipped; seed `b`: 7,874 passed, 1 failed (CR4-087), 5 skipped. Exit 0 and 1.
- **Not done here**: a third seed; the `quick`/`full` split's timing; running the 57 files under node (CR4-089 names the risk). R12 measures the build and startup; the suite's `import 538 s` line (vitest's own breakdown) says module loading is a cost of the same order as the tests themselves, which a smaller `src/config` import graph (R8's registries, R0's CR4-010) would lower.
