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

## Round 3 — 2026-06-29 — useGameState Cloning Optimization
- **Session**: [Conversation b25e2bab](Current session)
- **Target**: `useGameState.js` hook
- **Category**: `HPB` (Hot-Path Bloat) & `OC` (Over-Copying)
- **Changes**:
  - Replaced the default fallback of `structuredClone` inside `useGameState` with an extremely fast, prototype-preserving shallow clone: `Object.assign(Object.create(Object.getPrototypeOf(val)), val)`.
  - Avoided throwing and catching runtime exceptions on class instances (like `ModifierAggregator`) 10x/second per active card.
- **Metrics**:
  - Files modified: 1
  - Tests: 76/76 pass
  - Build: ✅
- **Commit**: `4f7bcca`

---

## Round 4 — 2026-06-29 — CardSystem Progress Event Filtering
- **Session**: [Conversation b25e2bab](Current session)
- **Target**: `CardSystem` & `ProgressBar`
- **Category**: `HPB` (Hot-Path Bloat)
- **Changes**:
  - Modified `CardSystem.tick` to publish `cards_progress_updated` with `cardIds` and `heroIds` of active/working entities instead of a generic bulk trigger.
  - Added filter logic inside `ProgressBar.jsx`'s `useGameTick` callback to skip evaluation and DOM updates for progress bars that are not associated with active/ticking entities.
- **Metrics**:
  - Files modified: 2
  - Tests: 76/76 pass
  - Build: ✅
- **Commit**: `7047160`

---

## Round 5 — 2026-06-29 — Library Card Preview Gutter Subscription Cleanup
- **Session**: [Conversation b25e2bab](Current session)
- **Target**: `LibraryCardPreviewGutter.jsx`
- **Category**: `RS` (Redundant Subscription)
- **Changes**:
  - Removed unused `useGameState` import and subscription (`const GameState = useGameState(state => state)`) inside the sidebar component.
  - Eliminated high-frequency re-renders of the preview sidebar on every state tick when the modal is open.
- **Metrics**:
  - Files modified: 1
  - Tests: 76/76 pass
  - Build: ✅
- **Commit**: `fec4d17`

---

## Round 6 — 2026-06-29 — CombatProcessor.js Modularization
- **Session**: [Conversation b25e2bab](Current session)
- **Target**: `CombatProcessor.js`
- **Category**: `OF` (Oversized Files)
- **Changes**:
  - Refactored `CombatProcessor.js` to extract combat resolution and combat attack mechanics into separate modular helper files (`CombatResolutionProcessor.js` and `CombatAttackProcessor.js`).
  - Reduced `CombatProcessor.js` file length from 322 lines to 125 lines, satisfying the project's 200-line guideline.
- **Metrics**:
  - Files modified/created: 3
  - Tests: 76/76 pass
  - Build: ✅
- **Commit**: `46ea7c4`

---

## Identified But Not Yet Executed

The following issues were identified during the Round 1 audit session but have not yet been fixed. They should be prioritized in future rounds.

### From Audit Report (High Priority)
*All high-priority audit items from the original report have now been fully resolved, optimized, or verified as already consolidated/clean:*
- **Item #1**: Optimized `useGameState` prototypes shallow clone (Round 3).
- **Item #2**: ProgressBar direct-DOM bypass (Round 2).
- **Item #3**: CardSystem event ID filtering (Round 4).
- **Item #4**: `combat_tick` event removed (Obsolete).
- **Item #5**: `InvItemRow` listeners consolidated in parent `InvView` (Already Clean).
- **Item #6**: `ThreatSystem` tick rate throttled to 60,000ms (Already Clean).
- **Item #7**: Registry getter functions returning frozen direct references (Already Clean).
- **Item #8**: `AudioSystem` utilizing `_sfxCache` for sound pools (Already Clean).
- **Item #9**: Library gutter GameState subscription removed (Round 5).
- **Item #10**: Combat HP/energy bars optimized via direct-DOM mapping (Round 2).

### Organizational Recommendations (From Structural Audit)
| # | Category | Finding | Impact | Risk | Priority |
|---|----------|---------|--------|------|----------|
| A | `OC` | State instances copy all static properties from registries. Should use flyweight/proxy pattern for dynamic resolution. (Already Clean). | 5 | 4 | +1 |
| B | `OF` | Remaining system files exceed 200-line guideline: `NotificationSystem.js` (410), `AssignmentSystem.js` (347), `SaveManager.js` (324). | 3 | 3 | 0 |
| C | `DC` | Centralized database loader recommended to replace per-registry `import.meta.glob` calls. | 2 | 4 | -2 |
