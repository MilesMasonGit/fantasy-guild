# Optimization Log

> Living document tracking all optimization work across sessions.
> Updated by the Auditor after each completed round.

---

## Round 1 — 2026-06-23 — Codebase Cleanup (Dead Files)
- **Session**: [Conversation 3c92b9ff](Previous Auditor session)
- **Target**: Root-level dead files, obsolete scripts, stale test directories
- **Category**: `DC` (Dead Code)
- **Changes**:
  - Removed 15 files: `_so_post.html`, `build_log.txt`, `extract_colors.cjs`, `flip_farmland.cjs`, `remove_grout.cjs`, `test_mastery_unified.js`, plus scripts and test directories
  - Removed directories: `tmp/`, `src/tests/experimental/`, `scripts/dev/`
- **Metrics**:
  - Files removed: 15
  - Tests: 76/76 pass
  - Build: ✅
- **Commit**: `a10535c` (included in progress save)
---

## Round 2 — 2026-06-29 — ProgressBar Direct-DOM Optimizations
- **Session**: [Conversation b25e2bab](Current session)
- **Target**: `ProgressBar` & Related UI Modules (`StatBarsModule`, `QuestProgressModule`, `HeroGroup`)
- **Category**: `HPB` (Hot-Path Bloat)
- **Changes**:
  - Modified `ProgressBar.jsx` to allow direct-DOM updates when `heroId` is provided even without `cardId`.
  - Added support for direct hero-hp and hero-energy tracking from the raw GameState without React re-renders.
  - Resolved potential crash/type errors on card lookup properties in `useGameTick` callback.
  - Linked `combat-hero-attack` target type to slot-specific tick processes.
  - Configured `StatBarsModule`, `QuestProgressModule`, and `HeroGroup` to pass appropriate identifier keys (`heroId`, `cardId`) for direct-DOM paths.
- **Metrics**:
  - Files modified: 4
  - Tests: 76/76 pass
  - Build: ✅
- **Commit**: `pending`

---

## Identified But Not Yet Executed

The following issues were identified during the Round 1 audit session but have not yet been fixed. They should be prioritized in future rounds.

### From Audit Report (High Priority)
| # | Category | Finding | Impact | Risk | Priority |
|---|----------|---------|--------|------|----------|
| 1 | `HPB` | `useGameState` runs `structuredClone` on every state update; throws and catches exceptions for cards with class instances (`ModifierAggregator`), falling back to shallow copy. 10x/sec per active card. | 5 | 3 | +2 |
| 3 | `HPB` | `CardSystem.tick` publishes `cards_progress_updated` without `cardId`, causing ALL card components to re-evaluate state simultaneously. | 4 | 2 | +2 |
| 4 | `ES` | `combat_tick` event published 10x/sec per active fight with full HP/energy snapshots. Zero subscribers in the entire codebase. | 4 | 1 | +3 |
| 5 | `RS` | Each `InvItemRow` registers 3 separate EventBus listeners for flash animations. 50 items = 150+ subscriptions. Should consolidate to parent. | 4 | 2 | +2 |
| 6 | `ES` | `ThreatSystem.js` publishes `chaos_updated` and `invasion_threat_updated` every 100ms tick for values that change over hours. | 3 | 1 | +2 |
| 7 | `OC` | `getAllItems()`, `getAllRecipes()`, `getAllEnemies()` return spread copies on every call. Should return frozen direct references. | 3 | 1 | +2 |
| 8 | `HPB` | `AudioSystem.js` allocates `new Audio(src)` on every sound play. `_sfxCache` is declared but never used. | 3 | 1 | +2 |
| 9 | `RS` | Card library and vault modals use `useGameState(state => state)` triggering deep clones of entire state on any event. | 3 | 2 | +1 |
| 10 | `HPB` | Combat HP/energy bars don't use direct-DOM `useGameTick` optimization; forced through React re-renders. | 3 | 2 | +1 |

### Organizational Recommendations (From Structural Audit)
| # | Category | Finding | Impact | Risk | Priority |
|---|----------|---------|--------|------|----------|
| A | `OC` | State instances copy all static properties from registries. Should use flyweight/proxy pattern for dynamic resolution. | 5 | 4 | +1 |
| B | `OF` | Several system files exceed 200-line guideline: `NotificationSystem.js` (409), `AssignmentSystem.js` (347), `CombatProcessor.js` (321), `SaveManager.js` (324). | 3 | 3 | 0 |
| C | `DC` | Centralized database loader recommended to replace per-registry `import.meta.glob` calls. | 2 | 4 | -2 |
