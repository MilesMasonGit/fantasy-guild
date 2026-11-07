# R0: The map

*Reviewer session R0, 2026-11-07, read at `main` **ea6b9f92** in the worktree `.claude/worktrees/rw`.
Inputs: `docs/reference/ARCHITECTURE.md`, the five tool reports re-run at this commit (knip 6.44.1,
dependency-cruiser 18.7.2, `tools/cycles.mjs`, jscpd 5.0.16, eslint 10.8.1) and
`tools/reachability.mjs`, compared with the saved baselines in `baseline/` (taken at 93338609).
Every path below was checked to exist at ea6b9f92.*

## Session summary (for the owner)

**What this area is.** Not a feature: the map of the code. This session checked whether the
architecture document still describes the game as it is, and read what the five code-health
tools say about the whole codebase: how the folders depend on each other, whether anything
imports in a circle, what is dead, what is copy-pasted, and what the linter flags.

**How healthy it is.** Good. The architecture document is accurate: of 119 `path:line`
references in it, none points at a missing file or past the end of a file, and every count I
re-measured matched or moved by a hair (one dev file was deleted since). The tool reports at this
commit are the same as the baselines taken two days ago: one import cycle group (kept harmless by
three deliberate dynamic imports), zero layer-rule errors, 15 unused files (all in `bench/` and
`tools/`, none in the game), 68 copy-paste clones covering 0.78 % of the lines, 79 lint problems
of which 12 are research scripts outside the game. I also confirmed that the production bundle
contains **none** of the QA panel, perf harness or bench code (0 hits for twelve dev-only markers
in `dist/assets/index-*.js`), so the dev imports in production components cost the player nothing.

**The three findings that matter most.**
1. **CR4-001**: the only import cycle in the game (16 modules) exists because the save store
   itself reaches into the hero and equipment code to rebuild heroes on load. Moving that
   rebuild step out of the store, to the one place that calls it, would dissolve the cycle for
   good. Invisible to the player; it makes the engine easier to change safely.
2. **CR4-003**: about 4,300 lines of ground-picture drawing code (how the grass, water and
   lava under the Tokens are painted) live in the engine folder although only the drawing side
   uses them, with their tuning sliders parked in `config/` for the same reason. Moving them
   beside the other drawing code makes the engine/drawing boundary true again.
3. **CR4-010**: about 6,800 lines of the CMS's economy simulator live inside the game's source
   folder, reached only by the CMS and its tests. Nothing wrong today, but every tool has to be
   told to look past it, and it is the one thing that makes "unused" hard to answer.

**Counts.** 12 findings: 10 `cleanup`, 1 `test`, 1 `docs`. 0 `owner-decision`. 0 `perf`,
0 `memory`: nothing in this area is about speed. All 12 verified by a second reader (Sonnet,
read-only), who corrected five details (counts and line numbers), folded in; none refuted.

**For the director to measure first.** Nothing here needs a bench. If CR4-003 (moving the
ground-picture code) is done, `npm run bench:draw -- --compare` must come back unchanged; if
CR4-001 is done, the engine bench's work check must come back unchanged.

**What the tools say, in plain words (the map itself).**
- *Layers.* The intended order was utilities < config < state < systems < UI. What actually holds:
  nothing outside the UI imports the UI; the engine never imports React; the save store reaches the
  engine only through three dynamic imports; content loading never reaches the save. What does not
  hold, and is now written into the rules as accepted: the content registries import a small
  "pure kernel" of 13 engine modules (22 edges, mostly content-id migrations and the statement
  grammar), and `utils/` reads config (8 edges, 6 of them from `CombatFormulas`, CR4-002).
  `npm run depcruise`: 614 modules, 3,746 edges, 0 errors, 24 warnings (23 cycle paths, 1
  utils→systems).
- *Reachability.* 599 non-test modules under `src/`; 584 are reachable from `src/main.jsx`. The
  15 that are not: 12 are CMS-only (CR4-010), 1 is a Web Worker loaded by URL (fine), 2 are
  imported by tests only (`RingBadge.jsx`, CR4-005; `terrainDev.js`, already ticket T-300).
- *Dead code.* knip: 15 unused files (bench scenarios and tools), 201 unused exports (98 in
  `src/ui/components`, 29 in `src/ui/dev`), 158 duplicate exports (a named export beside a
  `default` of the same thing), 1 unused dependency, 2 unlisted, 1 missing binary. Its two blind
  spots (CR4-006) mean the real dead-code list is longer; R9 reads the exports.
- *Copy-paste.* jscpd: 68 clones, 626 duplicated lines of 114,915 (0.54 %). 23 of them are inside
  the QA panel's fixtures (`src/ui/dev/*Dev.js`), 10 are inside the terrain and water-shape
  painters, and a handful are real logic twins (CR4-011).
- *Lint.* 79 problems (74 errors, 5 warnings): 64 unused variables, 5 React hook-rule errors (all
  one misnamed test fixture, CR4-009), 5 hook-dependency warnings, 4 useless assignments, 1
  constant condition. 38 are in tests, 12 in research scripts under `docs/active/research`, 21 in
  the game. The main folder reports 581 because it lints every other session's worktree
  (CR4-007). The residue itself is ticket T-058.

---

## Findings

### CR4-001  The game's one import cycle is held open by the save store rebuilding heroes
- **Tag**: cleanup
- **Priority / Effort / Risk**: P2 / M / medium
- **Confidence**: verified
- **Where**: `src/state/GameState.js:31-54` (`initFromSave` → `_rehydrateAll`, three `await import(...)`), `src/systems/core/SaveManager.js:365` (the only caller of `initFromSave`)
- **What**: `GameState` is the save store; it should sit below the engine. But after a load it rebuilds every hero (`rehydrateHero`, `recalculateEquipmentModifiers`, `assignFlagColours`) by importing `HeroManager`, `EquipmentManager` and `FlagColours` at run time. Those modules import `GameState` back, so 16 modules (`GameState`, `FlagColours`, `EquipmentManager`, `EquipmentValidator`, `heldCopies`, `HeroEffects`, `HeroManager`, five `hero/logic/*`, `InventoryFormatter`, `InventoryManager`, `InventoryStore`, `RegistryManager`) are mutually reachable. The dynamic imports keep it from breaking at load time, and a comment in the code says so, but every one of the 23 cycle paths depcruise reports runs through these three lines. A static import added by mistake anywhere in the group closes the cycle at load; `npm run cycles` and the `no-static-cycle` rule exist to catch that.
- **Evidence**: `npm run cycles` at ea6b9f92: "Cycle 1 — 16 modules mutually reachable [broken at load time by a dynamic import]: `src/systems/board/FlagColours.js -> src/state/GameState.js =(dynamic)=> src/systems/board/FlagColours.js`"; `npm run depcruise`: 23 `no-circular` warnings, each listing `src/state/GameState.js`. `grep -rn initFromSave src` outside tests: `GameState.js:31,33` and `SaveManager.js:365` only.
- **Fix sketch**: Make `initFromSave` synchronous and dumb (`this.state = savedState; this.isInitialized = true`) and move the body of `_rehydrateAll` into the load path beside its caller (a `rehydrateLoadedState()` in `src/systems/core/` called from `SaveManager.loadSlot` right after `initFromSave`, with static imports of the three modules). `GameState` then imports nothing from `src/systems`, the group dissolves, and the `state-systems-dynamic-only` rule can become "state never imports systems". Must not change: the order of work on load (heroes rebuilt before `GAME_LOADED`, `SaveManager.js:365-384`), the `quests` back-fill for old saves (`GameState.js:56-65`), the bench work fingerprint. Tests that call `GameState.initFromSave` directly and expect rehydrated heroes need the new helper.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. Read GameState.js:31-54 and the warning comment; ran tools/cycles.mjs (1 group, 16 members as listed, 0 static) and depcruise (23 no-circular, 1 utils-only-utils); grepped initFromSave (SaveManager.js:365 the only non-test src caller; bench/scenarios/hour-after-load.mjs also calls it); ran its own strongly-connected-components pass over the non-test import graph with GameState removed: 0 cycle groups remain.

### CR4-002  `CombatFormulas` is combat logic filed under utilities
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/utils/CombatFormulas.js:4-23` (imports from `config/FormulaRegistry.js`, five `config/registries/*` and `systems/effects/constants.js`); 405 lines
- **What**: `utils/` is meant to be the bottom layer (logger, RNG, formatters). `CombatFormulas` reads six content registries and an engine constants table, which is why `utils → config` has 8 edges (6 of them this file) and why the `utils-only-utils` rule carries its single warning. Its 19 importers are all engine and UI modules (`systems/combat/*` 4, `systems/board/BoardCombat.js` and `Flags.js`, `systems/hero/*` 3, `systems/equipment/Breakage.js`, `systems/effects/LiveEffects.js`, `ui/components/combat/fightView.js`, seven QA fixtures in `ui/dev`); seven more files only mention it in comments. Nothing about it is a utility; it is the combat system's maths.
- **Evidence**: `npm run depcruise`: `warn utils-only-utils: src/utils/CombatFormulas.js → src/systems/effects/constants.js`; folder edges from the depcruise JSON: `src/utils -> src/config` 8 (`AssetManager.js` 2, `CombatFormulas.js` 6). `grep -rln CombatFormulas src cms/src` outside tests: 26 files, of which 19 import it (the verifier's count) and 7 name it in comments; none in `utils/`, `cms/` or `bench/`.
- **Fix sketch**: Move the file to `src/systems/combat/CombatFormulas.js` and update the 19 import paths plus the tests that import it. No code inside changes. After the move `utils/` reads only the sprite manifest (`AssetManager.js`), and the `utils-only-utils` rule can go to `error` at 0. Must not change: the bench work fingerprint (pure move).
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed after one correction. Header imports, 405 lines, the single utils-only-utils warning and the 8 utils→config edges all hold; the importer count was 26 files naming it, of which 19 import it and 7 mention it in comments (corrected above).

### CR4-003  4,262 lines of ground-picture painting live in the engine folder but only the drawing side uses them
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: verified
- **Where**: `src/systems/board/TerrainGrass.js`, `TerrainLattice.js`, `TerrainBlend.js`, `TerrainPatches.js`, `TerrainShade.js`, `TerrainProps.js`, `TerrainBands.js`, `TerrainSurface.js` (8 files, 4,262 lines); their tuning store `src/config/playmatTuning.js:7-11`
- **What**: These modules paint the ground canvas under the Tokens (grass, water edges, lava, shade). They hold no game state and no rule a Token obeys. Their only importers are five UI files: `ui/components/board/TerrainCanvas.jsx`, `groundSheets.js`, `groundScreen.js`, `ambientGround.js` and `ui/components/atlas/mapPreview.js` (plus two micro-benches, `bench/micro/groundPlan.bench.js` and `groundScreen.bench.js`); no module in `src/systems` imports them. They themselves read only `config/registries/terrainRegistry.js`, `config/playmatTuning.js` and three Region-shape helpers in `systems/atlas` (`TerrainMap.js`, `WaterShapes.js`, `Layout.js`). `playmatTuning.js`'s own header says it sits in `config/` only because "the ground plan's modules are systems" and systems may not import the UI. So a fifth of `systems/board` (4,262 of 20,110 lines) is drawing code, and a dev tuner is parked in `config/` to reach it.
- **Evidence**: depcruise JSON, edges into `src/systems/board/Terrain*`: from `src/ui/components/atlas/mapPreview.js`, `src/ui/components/board/groundScreen.js`, `groundSheets.js`, `ambientGround.js`, `TerrainCanvas.jsx`, and the Terrain files themselves; nothing else. `grep -h "^import.*from" src/systems/board/Terrain*.js` outside the group: `terrainRegistry.js` (8), `playmatTuning.js` (8), `atlas/WaterShapes.js` (2), `atlas/Layout.js` (1), and `atlas/TerrainMap.js` (found by the verifier). `wc -l src/systems/board/Terrain*.js` = 4,262. `ARCHITECTURE.md` §5.3 and §7 already name this as "not encoded as a rule (a review decision)".
- **Fix sketch**: Move the eight files to `src/ui/components/board/terrain/` (or a new `src/ground/` if the atlas preview's import from `ui/components/atlas` should not cross into `board`), and `playmatTuning.js` beside them (it is a dev tool, not content; the Playmat Tuner panel in `ui/dev` is its only writer). Pure move, import paths only. Must not change: the ground picture (`npm run bench:draw -- --compare` unchanged; the draw bench's calibration stamp), the `terrain` draw switch's behaviour, the per-device localStorage key the tuner uses (`playmatTuning.js:15`). Not an eye-check: the picture is byte-identical if the move is pure.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed after one addition. 8 files, 4,262 lines (per-file counts checked), systems/board 20,110; importers are the five UI files plus two bench/micro files, nothing in systems or cms; the group also imports atlas/TerrainMap.js (added above); playmatTuning.js:7-11 says what is quoted.

### CR4-004  A content glob for a folder that does not exist, and the loop that reads it
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/config/DatabaseManager.js:11` (`itemFilesGlob: import.meta.glob('/data/items/**/*.json')`), `src/config/registries/itemRegistry.js:41,60-70` (the second loader loop), `src/config/registries/tokenRegistry.js:38-40` (a comment describing a folder glob the Token loader does not have)
- **What**: `data/` has no `items/` folder (`ls data`: `effects.json hallStars.json items.json maps.json palettes skillPerks.json starterCamp.json tokenRecipes.json tokens.json world.json`), so the glob is always `{}` and the loop at `itemRegistry.js:60-70` never runs. That loop is a verbatim copy of the one above it (jscpd reports it as a clone of `:47-57`). The Token loader's comment at `tokenRegistry.js:38-40` says it "mirrors `itemRegistry.js`'s loader: the single file first, then the folder glob", but reads only `tokens.json`. Harmless to the player; misleading to the next agent, who may think split item files are supported.
- **Evidence**: `ls data/items` → "No such file or directory"; jscpd: "Clone found: `config\registries\itemRegistry.js [47:69 - 57:6]` / `[60:67 - 70:6]`"; `ARCHITECTURE.md` §6 and §10 item 4 already note both.
- **Fix sketch**: Delete `itemFilesGlob` and the second loop; rewrite the `tokenRegistry.js` comment to say what the loader does. Must not change: how `items.json` is read and migrated (`:47-57`). If the owner ever wants split item files, the CMS would write them, and that is a design question for then.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. DatabaseManager.js:11 as quoted, data/items absent, itemRegistry.js:60-70 identical to :47-57 but for the source, loadJsonTokens reads tokenFilesSingle only; itemFilesGlob has exactly two hits across src, cms, bench, scripts, tools.

### CR4-005  `RingBadge.jsx` is drawn by nothing; only a test imports it
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/ui/components/board/RingBadge.jsx` (134 lines); its only importer `src/tests/RingGlide.test.js`; comments that point at it: `src/ui/components/board/ringRow.js:24`, `src/tailwind.css:759`
- **What**: A count-ring badge component that no screen mounts. `tools/reachability.mjs` lists it as unreachable from `src/main.jsx`; the only `import` of it in the repository is a test. Two comments in live code cite "`RingBadge`" as the explanation of why the ring glide is a CSS transition, so a reader is sent to a component the game never renders. knip does not report it because tests count as entry points (CR4-006).
- **Evidence**: `node tools/reachability.mjs`: `135 src/ui/components/board/RingBadge.jsx` under "UNREACHABLE from src/main.jsx"; `grep -rn RingBadge src cms bench` outside the file: `src/tests/RingGlide.test.js` (import), `src/tests/TickRedraws.test.js:305` (a string in a render-count table), `ringRow.js:24` (comment), `tailwind.css:759` (comment). No `React.lazy` or component registry names it.
- **Fix sketch**: Delete `RingBadge.jsx` with `RingGlide.test.js` (a test of dead code), unless R4 (Drawing) finds the CSS rule at `tailwind.css:759` is itself unused. Move the one-line "why this is CSS, not the frame clock" explanation into `ringRow.js` and `tailwind.css` so the comments stop pointing at a deleted file. Nothing the player sees changes: the component is not mounted today.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. Grepped src, cms, bench, scripts, tools: only the two comments, the RingGlide test import and a string in TickRedraws.test.js:305 (added above); no lazy or registry reference; reachability lists it unreachable; knip does not list it as an unused file.

### CR4-006  The dead-code tool is told that tests are users and that the CMS does not exist
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `knip.json:3-5` (every `src/tests/**/*.test.*` file is an entry), `knip.json:13` (`"ignore": ["cms/**"]`)
- **What**: Two settings make `npm run dead-code` an under-count in opposite directions. (1) Because test files are entries, a module that only tests import counts as used: `RingBadge.jsx` (CR4-005) and `terrainDev.js` (T-300) are both unreachable from the game and both absent from knip's "unused files". (2) Because `cms/**` is ignored, an export used only by the CMS (which imports 62 game modules by relative path) is reported as unused, so part of the 201 "unused exports" are false. knip itself prints a configuration hint at the end of its report: "`cms/**` knip.json Remove from ignore". R9 will read the 201 exports by hand; a better tool run would shrink that list to the real ones. Also minor: `knip.json:2`'s `$schema` points at knip 5; knip 6.44.1 is installed.
- **Evidence**: `npx knip` at ea6b9f92: "Unused files (15)", none in `src/`, while `node tools/reachability.mjs` lists 2 non-CMS, non-worker `src` files reachable from nothing but tests; knip's "Configuration hints (2)" block.
- **Fix sketch**: Add a second config, `knip.review.json`, whose entries are `src/main.jsx`, the CMS entry files, `bench/*.mjs`, `scripts/*`, `tools/*.mjs` (no tests) and whose `project` includes `cms/src/**`; add `"dead-code:strict": "knip --config knip.review.json"` to `package.json`. Leave `npm run dead-code` as it is so the saved baseline stays comparable. Then re-run for R9 and record both outputs in `baseline/`. Must not change: nothing in the game.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. knip.json entries, ignore and $schema as stated; knip 6.44.1; the configuration hint is printed; 15 unused files all outside src; reachability lists RingBadge.jsx and terrainDev.js; its own scan of cms/ found 62 distinct relative specifiers resolving into src/, matching the count.

### CR4-007  Lint from the main folder counts every other session's worktree
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `eslint.config.js:19-27` (the `ignores` list: `dist`, `dist-perf`, `node_modules`, `cms`, `archive`, `src-tauri`, `public`)
- **What**: The main checkout holds the other sessions' git worktrees under `.claude/worktrees/` (9 today, 11,448 script files outside `node_modules`), the owner's `_art_leftovers/` scraps, and research scripts under `docs/active/research/*/_tools/`. None is ignored, so `npm run lint` in the main folder lints up to ten copies of the game: the director saw 581 problems there against 79 in a clean worktree (`ARCHITECTURE.md` §9). The research scripts alone add 12 of the 79 (`docs/active/research/hall_look/_tools/inject.js:150` is the one `no-constant-condition`). Ticket T-058 (the lint residue) will be measured against the wrong number from the main folder.
- **Evidence**: From the main folder, `npx eslint --print-config .claude/worktrees/rw/src/main.jsx` and `npx eslint --print-config _art_leftovers/x.js` both print a config (an ignored path prints a notice instead). `Get-ChildItem -Recurse .claude/worktrees -Include *.js,*.jsx,*.mjs,*.cjs` outside `node_modules`: 11,448 files. Lint JSON at ea6b9f92 grouped by folder: `docs/active` 12, `scripts` 8, `src/tests` 38, `src/systems` 5, `src/ui` 16.
- **Fix sketch**: Add `'.claude/**'`, `'_art_leftovers/**'` and `'docs/**'` to `ignores` (one line each). The main folder then reports the same 67 problems as a worktree minus the research scripts. Must not change: the rules themselves (T-058 decides those).
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. Read eslint.config.js:19-27 (seven ignores, none for .claude, _art_leftovers or docs); from the main checkout --print-config printed a config for a worktree file and an _art_leftovers file; worktree lint JSON: 79 problems (74/5), folder counts docs 12, scripts 8, src/systems 5, src/ui 16, src/tests 38; the one no-constant-condition is inject.js:150.

### CR4-008  `package.json` lists a package nothing uses and misses two that tests and the coverage config use
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `package.json:71` (`"@dnd-kit/modifiers": "^9.0.0"`), `src/tests/CMSLedgerPlan.test.js:7` (`picomatch`, not in `package.json`), `vitest.config.js` (`@vitest/coverage-v8`, not in `package.json`), `package.json:40` (`depcruise:graph` pipes into `dot`, which is not installed)
- **What**: `@dnd-kit/modifiers` is installed and shipped in `node_modules` but imported by no file in `src/` or `cms/` (`grep -rn "@dnd-kit/modifiers" src cms/src` → only `package.json`). `picomatch` and `@vitest/coverage-v8` are used but only present because another package pulls them in: an `npm update` elsewhere can remove them and break one test and `npm run coverage`. `depcruise:graph` can only work on a machine with Graphviz; here it fails at the pipe, and its output path `docs/active/review/module_graph.svg` is the review folder (fine now that the folder exists, but the graph has never been produced).
- **Evidence**: knip at ea6b9f92: "Unused dependencies (1) `@dnd-kit/modifiers package.json:71:6`; Unlisted dependencies (2) `picomatch src/tests/CMSLedgerPlan.test.js:7:23`, `@vitest/coverage-v8 vitest.config.js`; Unlisted binaries (1) `dot package.json`".
- **Fix sketch**: `npm uninstall @dnd-kit/modifiers`; `npm install -D picomatch @vitest/coverage-v8` (pin to the versions already in `package-lock.json`); either install Graphviz on this PC and run `depcruise:graph` once for the review, or note in the script's name that it needs `dot`. The lockfile changes, so this is a code commit with no `data/`. Must not change: the four other `@dnd-kit/*` packages the drag code uses.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. package.json:71 as quoted, no import of @dnd-kit/modifiers anywhere outside node_modules; picomatch imported at CMSLedgerPlan.test.js:7 and absent from package.json and cms/package.json (transitive only); vitest.config.js:63-64 sets coverage provider v8 and node_modules/@vitest/coverage-v8 does not exist; package.json:40 as quoted; `which dot` finds nothing.

### CR4-009  Five "React hook" lint errors are one test helper with a hook's name
- **Tag**: test
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/tests/fixtures/outerUpgrade.js:26` (`export function useOuterUpgrade()`), called at module top level in `src/tests/GuildHallPlaymat.test.js:24`, `GuildHallWeb.test.js:31`, `HallCeremony.test.js:38`, `HallSky.test.js:34`, `ModalAndUpgradePanel.test.js:19`
- **What**: `useOuterUpgrade` is not a React hook: it registers a vitest `beforeEach`/`afterEach` pair that adds a test-only Guild Hall star to the upgrade web. Because its name starts with `use`, `react-hooks/rules-of-hooks` reports every top-level call as a broken hook. All 5 of the suite's `rules-of-hooks` errors are this; there is no real hook misuse in the game. Left as is, the one lint rule that catches genuine runtime bugs is always red and gets skimmed past.
- **Evidence**: eslint JSON at ea6b9f92, rule `react-hooks/rules-of-hooks`: the five sites above, message "React Hook `useOuterUpgrade` cannot be called at the top level"; `outerUpgrade.js:26-34` shows `beforeEach`/`afterEach` from `vitest`, no React import.
- **Fix sketch**: Rename to `withOuterUpgrade` (or `registerOuterUpgrade`) in the fixture and the five tests. Lint drops from 74 to 69 errors. Nothing in the game changes.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed. outerUpgrade.js:26 is a plain function calling vitest beforeEach/afterEach, no React import; the five call sites are at the cited lines at module top level; the worktree lint JSON has exactly those five rules-of-hooks hits.

### CR4-010  6,773 lines of CMS-only code live in the game's source folder
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / L / low
- **Confidence**: verified
- **Where**: `src/systems/progression/ledger/` except `engine.js` and `plan.js` (10 files: `balance`, `calibration`, `checks`, `economy`, `hall`, `pace`, `profiles`, `rates`, `settings`, `world`; 5,627 lines), `src/systems/effects/statementSlots.js` (979 lines), `src/config/registries/tempoBands.js` (167 lines)
- **What**: These twelve modules are the CMS's economy simulator and its vocabulary. Nothing reachable from `src/main.jsx` imports them; their importers are `cms/src/components/ledger/*`, `cms/src/engine/sim/*`, `cms/src/utils/constants.js` and 25 test files in `src/tests`. They are not dead (the CMS needs them) and they are not in the game bundle (Rollup drops what `main.jsx` cannot reach), so the player pays nothing. The cost is to the map: every tool and document has to carve them out by hand (knip's CMS blind spot, CR4-006; the reachability list; `ARCHITECTURE.md` §2.1 and §6), the 63 CMS test files run inside the game's 206 s suite (48 s of it, `baseline/suite.txt`), and a reader of `src/systems/progression` finds 6,881 lines of ledger beside 855 lines of actual progression. `engine.js` (the Encyclopedia's reach engine, 6 UI importers) and `plan.js` (which `engine.js` imports) are the exceptions and stay. Line counts here are `tools/reachability.mjs`'s (one more than `wc -l` per file).
- **Evidence**: `node tools/reachability.mjs`: the 12 files listed under "UNREACHABLE from src/main.jsx" with their line counts; `grep -rln progression/ledger cms/src`: 10 CMS files; `grep -rln "progression/ledger" src` outside tests: 6 UI files, all importing `engine.js`; `grep -rln statementSlots|tempoBands cms/src`: `cms/src/utils/constants.js`, `cms/src/engine/sim/{answers,tempoPass,tuningPass}.js`.
- **Fix sketch**: Two honest options for the planning agent to put to the owner as a batch question, neither urgent. (a) Move the twelve files to `cms/src/engine/ledger/` with their 25 tests to `cms/` (the CMS has its own vitest config), updating the import paths in `cms/src` and leaving `engine.js` where it is; the game's suite loses 48 s and knip's picture of `src/` becomes true. (b) Leave them, add a one-line README in `src/systems/progression/ledger/` saying which files are CMS-only, and encode it: a depcruise rule that nothing under `src/` outside `ledger/` and tests imports those twelve. Must not change: the CMS's Sync and its ledger pages, the `engine.js` the Encyclopedia uses, the content boundary (`data/` stays the only path from CMS to game).
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed with two notes folded in above: ledger has a twelfth file, plan.js, which engine.js imports (so it is reachable and rightly not among the ten); the line counts follow reachability.mjs (wc -l gives 6,761). Checked every importer of the ten ledger files, statementSlots.js and tempoBands.js across src, cms and bench: CMS code and tests only; the six UI importers take only engine.js; ledger 6,881 lines, the rest of progression 855.

### CR4-011  What the copy-paste detector found: 68 clones, nine of them real logic twins
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: verified
- **Where**: pairs below; the full report is in `baseline/jscpd.txt` (identical at ea6b9f92)
- **What**: jscpd (60 tokens, 5 lines, `src/` without tests) finds 68 clones, 626 lines of 114,915 (0.54 %). Most are not worth a change: 23 are inside the QA panel's fixture files (`ui/dev/*Dev.js`, the same scaffolding per skill), 10 are inside the terrain and water painters (`TerrainGrass.js` × 4 self-clones, `WaterShapes.js` × 5, `TerrainMap.js`), and a few are JSX that merely looks alike. The ones that are logic written twice, for R9 to file one by one:
  1. `src/systems/atlas/Budget.js:138-156` (`apportion`) and `src/systems/world/cellMat.js:86-103` (`shares`): the same 18-line largest-remainder apportionment; `cellMat.js:84` says it is "restated so this file stays import-light for the ledger" (the ledger is CMS-only, CR4-010).
  2. `src/config/matTuning.js:233-243` and `src/config/playmatTuning.js:545-555`: two dev tuner stores with the same set/clamp/persist/notify code.
  3. `src/ui/components/atlas/WorldCamera.jsx:126-201` and `src/ui/components/board/HallCamera.jsx` (4 clones): the mat-to-map glide and the mat-to-sky glide are the same camera written twice (`WorldCamera.jsx:196` even says "As the Hall's glide").
  4. `src/ui/components/dock/DockHeroFigure.jsx:2-11,68-83,163-173,208-216` and `src/ui/components/dock/HeroDockTab.jsx` (4 clones): the hero dock figure and the bank-panel hero tab share drag wiring and roster-state text.
  5. `src/config/registries/itemRegistry.js:47-57` and `:60-70` (CR4-004, the dead loop).
  6. `src/systems/board/Orders.js:39-46` and `src/ui/components/board/flagText.js`.
  7. `src/systems/atlas/seededRandom.js:18-25` and `src/ui/components/board/ambientGround.js`, and `seededRandom.js` and `systems/atlas/regionNames.js:73-79`: a seeded RNG helper written three times.
  8. `src/ui/components/atlas/mapPreview.js:157-167` and `src/ui/components/board/groundSheets.js`: the ground-sheet set-up for the map preview and the mat.
  9. `src/systems/notifications/catchUpNews.js:37-46` and `src/systems/notifications/routing.js`.
- **Evidence**: `npx jscpd` at ea6b9f92: "Found 68 clones", totals table `javascript 431 files 55 clones 484 lines (0.56 %)`, `jsx 158 files 13 clones 142 lines (0.51 %)`; pair list derived from the report's "Clone found" blocks.
- **Fix sketch**: R9 files each pair that matters as its own finding with its own risk; the camera pair (3) and the dock pair (4) touch what the player sees and would want an eye-check if merged; pairs 1, 2, 5, 7 are pure helpers and safe. Must not change: the bench work fingerprint for 1 and 7 (the RNG helper's sequence must stay bit-identical).
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed after two corrections (the Hall-glide comment is at WorldCamera.jsx:196; the QA-fixture clones number 23, not 20; both fixed above). Ran jscpd (68 clones) and read every cited pair; partner lines: ambientGround.js:29-36, regionNames.js:73-79, flagText.js:52-59, routing.js:85-93, groundSheets.js:50-60.

### CR4-012  `ARCHITECTURE.md` at ea6b9f92: six small drifts
- **Tag**: docs
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `docs/reference/ARCHITECTURE.md:4` (header: checked at 93338609), `:53-55` (the `src/` total and test count), `:78` (`src/ui/dev` row), `:79` (`src/ui/components` other row), `:489-490` (depcruise run line), `:534` (`depcruise:graph` "writes into `docs/active/review/`, which does not exist yet")
- **What**: The document is accurate; this finding records what moved in the 38 commits since it was checked, so the next reader does not re-derive it. Re-measured at ea6b9f92 with the doc's own counting convention (`cat | wc -l`, one more than `wc -l` per file): `src/` outside tests is 115,659 lines (doc: 115,131); 632 test files (doc: 627); `src/ui/dev` is 73 files / 9,828 lines (doc: 74 / 9,898; `qaLapStar.js` was removed by the Drop-lap commit 1e28bea0); `src/ui/components` other is 105 / 18,439 (doc: 18,334); `npm run depcruise` reports 614 modules, 3,746 dependencies (doc: 615, 3,748); `docs/active/review/` now exists. All 119 `path:line` references resolve (4 are glob patterns, not files). Everything else checked (the folder table's other rows, §2.1, §7's table, §9's lint count) matched exactly.
- **Evidence**: `find`/`wc -l` per folder at ea6b9f92; `npx depcruise src --config .dependency-cruiser.cjs` summary line; a script that resolves every backticked `path:line` in the doc against the worktree (0 missing files, 0 lines past end of file).
- **Fix sketch**: Update the six numbers and the header's commit; one docs commit. Nothing else in the document needs to change.
- **Verified by**: verifier (Sonnet, read-only, 2026-11-07): confirmed; the doc line numbers were wrong and are corrected above. Re-measured: 632 test files; 115,660 non-test lines by the +1-per-file convention (115,062 by wc -l); ui/dev 73 / 9,828; ui/components other 105 / 18,439; depcruise 614 modules, 3746 dependencies; docs/active/review exists; qaLapStar.js deleted by 1e28bea0 only.

---

## Notes (no `path:line` of their own, or another area's)

- **Verified clean, not a finding.** Production components import `src/ui/dev/perf/drawSwitches.js` (13 files) and `PerfProfiler.jsx` (3), `ReactRoot.jsx` imports `TestDashboard.jsx` and its 30 dev sections, and `ui/dev/perf/stressScenarios.js` imports `bench/` files dynamically (8 edges). All are gated on literal `import.meta.env` checks and compile out: the built `dist/assets/index-*.js` (2,128,288 bytes, built from 44b75a7a) has 0 hits for `TestDashboard`, `AnimationDevSection`, `DRAW_SWITCHES`, `PROFILED_SURFACES`, `S4 Push storm`, `__perf`, `installPerf`, `stressScenarios`, `terrainDev`, `RingBadge`, `jsonItemFilesGlob`. R12 (bundle) need not look here.
- **The accepted layering.** `config → systems` has 22 edges to 13 kernel modules (content-id migrations, the statement grammar, event-name tables, `wearRule`, `perkTable`, `hallStarText`, `TerrainMap`, `WaterShapes`), all because registries migrate content at import time. The rules encode this as `CONFIG_KERNEL`. Not re-litigated here; a move of the kernel to a `src/content/` folder would be an L refactor with no player value.
- **For R1 (the bus).** `engineEvents.js` declares 6 `ORPHAN_EVENTS` (subscribed, never published; four by `AudioSystem`) and 7 `NO_LISTENER` events; `STATE_CHANGED` is retired but travel still publishes it (`ARCHITECTURE.md` §3.3, §10 item 6).
- **For R5 (React plumbing).** 42 UI files import `GameState` directly; 11 edges `ui/components → src/state`, 12 `ui/dev → src/state`.
- **For R9 (dead code).** knip's 201 unused exports: 98 in `src/ui/components`, 29 in `src/ui/dev`, 14 in `src/config/registries`, 8 `systems/core`, 7 `systems/progression`, 6 each `systems/effects` and `systems/board`; 158 duplicate exports (a named export beside `export default`, e.g. `DatabaseManager.js`, `SaveManager.js`, `HeroManager.js`, 55 UI components). Run the strict config (CR4-006) first. In-game `no-unused-vars` hits worth a look: `BoardRunner.js:17` `RECIPE`, `SpriteLayer.js:39` `MERGE_GRACE_MS` (T-058 says keep), `EngineBootstrap.js:10` `NotificationSystem`, `LootSystem.js:103` `areaId` (an area-era argument), seven `import React` lines in `ui/components/board/*` under the new JSX transform.
- **For R10 (tests).** 38 of 79 lint problems are in `src/tests` (unused imports and variables); 2 unused exports in `src/tests/fixtures`.
- **For R12 (shell, build).** One 2.13 MB script, no code splitting (`baseline/bundle.txt`); the three "dynamic import will not move module" build warnings from round 3 (CR3-509) are the ones at `GameState.js:47-54`, which CR4-001 would remove.
- **Already ticketed, not re-filed.** `terrainDev.js` imported by tests only and `data/maps.json` read by nothing: T-300. The lint residue itself: T-058. Deck-era names (`DeckDndProvider`, `cardUseCounts`): T-056, T-108.
