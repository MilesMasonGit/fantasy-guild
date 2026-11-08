# Brief 540 — Code review round 4: cleanup by folder, then docs

*Written 2026-11-07 by the planning agent from the round-4 triage. Low risk, mechanical, invisible to the
player: deletions grouped by folder (one slice per folder, not one per finding), the folder moves, the
tools, the owner's two small rulings, and one docs pass at the end.*

**What the player gets.** Nothing visible. Keyboard users stop being offered a drag that does nothing.
Agents reading the code stop tripping on machinery that is gone, and the import-cycle and dead-code
reports can become part of the merge gate.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md`, and each ticket's findings in
`docs/active/review/` (search the CR4 ids in the ticket's Origin; the items to delete are listed there with
`path:line`). R9's Notes (`R9_dead_code_duplicates_cycles_lint.md`) gather every cleanup finding.
**Delete tests only with the code they test.** The owner answered the four parked questions on 2026-11-07 (all yes, in
`docs/active/review/STATUS.md`); nothing in this brief waits.

## Phases

| Phase | Ticket (findings) | What | Tier |
|---|---|---|---|
| C1 | T-373 (CR4-001, 002, 003), T-381 (CR4-010) | **Folder moves.** First the import cycle: make `GameState.initFromSave` a plain assignment and move `_rehydrateAll`'s body into the load path (`src/systems/core/`, called from `SaveManager.loadSlot`, static imports); the cycle report reads 0 groups. Then pure moves: `CombatFormulas.js` to `src/systems/combat/`, the eight terrain painters and `playmatTuning.js` beside the drawing code, and the CMS-only ledger files with their 25 tests into `cms/` (owner 2026-11-07: yes; `engine.js` and `plan.js` stay; the CMS suite must pass). Bench work check same work; the ground picture unchanged (`bench:draw -- --compare`); a load of a saved game in the running game. | builder |
| C2 | T-374 (CR4-029, 030) | **`src/systems/board/`**: delete the starvation tally and its tests' reads; the ten exports with no caller (check the QA recall button goes through `Flags.furl` before deleting `recallHeroById`); replace the round-3 copies with the shared helpers (measure the push bench S4 before and after `clampOnto`). | builder-lite |
| C3 | T-375 (CR4-038, 039, 040, 041) | **Hero, effects, combat, progression**: the aggregator's dead cache, expiry, source switches and unused constants (check the CMS authors none of the `TARGET_CATEGORIES` keys first); card-era paths (`combat_trigger`, `areaId` in loot, `setAssignment`; the thorns trait branch and `COMBAT_ENEMY_TRAIT_TRIGGER` (owner 2026-11-07: delete)); `provenance` and `newDiscoveries` and their readers, dropped from old saves by `SaveMigration`; unused exports, the three `withArticle` copies pointed at the export. | builder-lite |
| C4 | T-376 (CR4-004, 014, 067, 072, 080) | **Core, state, config**: the defeat and "invasion" sounds, their subscriptions and the dead events (**owner ruling 2026-11-07: drop both**; `ORPHAN_EVENTS` empties and goes); the seventeen dead saved fields, `cards` out of `REQUIRED_KEYS`, the `classId` fallbacks; the migration branches the version check makes unreachable, `quests.active`, the `bankedSkills` fold and its QA scene (`classlessDev.js`); the item glob for `data/items/` and its loop; the simulator's Maps dial (closes T-140 too). Never edit `data/`: `data/maps.json` stays until the owner removes it (one line in the owner to-do). | builder |
| C5 | T-377 (CR4-075) | **World, atlas, quests**: `abandonQuest`, the `sourceRect` parameter, three re-exports, the Regions reroll (planning call: delete), `ignored`, `anywhereDry`, `installedSources`, five unimported exports; `lookups()`'s memo to module level. | builder-lite |
| C6 | T-378 (CR4-005, 055, 065), T-309 (CR4-064), T-370 (CR4-063) | **`src/ui/`**: `RingBadge.jsx` and its test (move its one-line "why CSS" note to `ringRow.js`); dead constants, keyframes and classes and the always-empty `arrived` listener (the charge-change floater `TokenChargeDeltaFloater` and its CSS too: owner 2026-11-07, delete); the slot screen's notification listeners gated on `isOpen`, `settle` in a `useCallback`; the `HERO` drag kind, `ViewportContext.jsx`, the unused `bold` parameters (T-309). **The owner's ruling on keyboard drag (2026-11-07, option b)**: `useEntityDrag` defaults `keyboardAccessible` to false, so drag sources lose the Tab stop and the screen-reader text; pointer drag unchanged (drag bench, and drag a hero, a Bank item and a Shop row in the running game). | builder |
| C7 | T-379 (CR4-011, 082, 083) | **Across folders**: the 49 dead exports and the 127 stray `export default` lines (knip's list), one commit per folder; one helper per duplicated group (R0's nine, R9's nine). The RNG helper's sequence must stay bit-identical (bench); the camera and dock pairs touch the look: leave them for a later look-preserving slice if a pixel moves. | builder-lite |
| C8 | T-380 (CR4-006, 007, 008, 009, 085), T-058 (CR4-084) | **Tools and lint**: `knip.review.json` and a `dead-code:strict` script (keep `npm run dead-code` as it is); eslint `ignores` for `.claude/**`, `_art_leftovers/**`, `docs/**`; `npm uninstall @dnd-kit/modifiers`, `npm install -D picomatch @vitest/coverage-v8` at the lockfile's versions; the hook-named test helper renamed; the five lint errors that are lost logic (T-058's row) and the stray names. Report knip, cycles, depcruise and lint counts after; propose to the director whether cycles, depcruise and lint join the merge gate. | builder-lite |
| C9 | T-369 (CR4-013), T-382 (the docs findings) | **Docs, one pass, last.** The owner's playtime ruling (2026-11-07): `meta.totalPlaytime` is the guild's whole time including accepted away time; the field's comment and the handler's (`EngineBootstrap.js:166-172`) say so; no behaviour change. Then every comment and doc line the docs findings list (CR4-012, 031, 045, 056, 066, 071, 077, 081, 086, 091, 095, 100), skipping lines a phase above already deleted; `TESTING.md` gets the second-seed run in the bench window's routine; `npx update-browserslist-db@latest` as a commit of its own. The desktop release-size settings in `Cargo.toml` (owner 2026-11-07: yes), checked with one `tauri:build`. | builder-lite |

**Order.** C1 first (it moves files the others touch). C2 to C6 touch different folders and may run two at a
time. C7 and C8 after them (they sweep every folder). C9 last.

## Done when

- Gate green per phase; bench work check **same work** for every phase (any change is a mistake here: stop
  and report).
- After C1 and C8: cycles 0 groups, depcruise 0 violations, knip's unused exports and lint errors down by
  the counts the findings give (report the numbers).
- In the running game, named as verified: a saved game loads (C1, C4), drag still works by pointer and Tab
  no longer stops on drag sources (C6), a fight and a Sync-free play session of a few minutes run clean.
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: no.** One line in STATUS per phase; C6's keyboard change gets one line too.

## Owner to-do

When convenient, delete `data/maps.json` through the CMS file manager if it offers it (it is `{}` and read
by nothing); otherwise tell the planning agent and it stays.
