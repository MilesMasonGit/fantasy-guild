# Code Review — Findings Tracker

Persistent tracker for the full-codebase review. See
[`code_review_guide.md`](code_review_guide.md) for objectives, scoring, and
the session plan. **Every review session writes into this file**; fix sessions
later update ticket statuses here.

---

## Session Status *(update at the end of every session)*

| # | Session | Status | Notes |
|---|---|---|---|
| — | Prerequisite: commit in-flight DnD rework | ✅ Done (2026-07-17) | Committed in `54c78f2` (with station/consumables redesign) |
| — | Prerequisite: Phase 9 Legacy Cleanup (roadmap) | ✅ Done (2026-07-17) | See roadmap status table — flag removed, ~60 files deleted, CMS included |
| — | Prerequisite: baseline test run recorded | ✅ Done (2026-07-17) | **81/81 tests green** (14 files) after legacy-suite pruning |
| 1 | State core & serialization | ✅ Done (2026-07-17) | 16 tickets filed (CR-004–CR-019); 2×P1, 6×P2, 6×P3, 2 stubs. All 18 territory files read in full. |
| 2 | Loop engine | ⬜ Not started | |
| 3 | Combat, heroes & status effects | ⬜ Not started | |
| 4 | Cards, collection, economy & quests | ⬜ Not started | |
| 5 | UI ↔ engine boundary | ⬜ Not started | |
| 6 | UI components | ⬜ Not started | |
| 7 | Runtime verification (hands-on) | ⬜ Not started | Requires 1–6 |
| 8 | Build, Tauri readiness & synthesis | ⬜ Not started | Goes last |

**Next ticket ID:** CR-020

---

## Ticket Format

```
### CR-NNN · P0–P3 · S/M/L · Session N · Status: Open
- **Where**: src/path/File.js:123
- **What**: One-sentence statement of the defect or debt.
- **Why it matters**: Plain-language impact on the game or player.
- **Suggested fix**: Concrete direction (not a full diff — those are written
  by the fix session against current code).
- **Related**: CR-XXX, roadmap §, or concept doc reference (if any).
- **Confidence**: Only if suspected-but-unproven; say what would confirm it.
```

Statuses: `Open` → `Fixed (date, commit)` / `Won't fix (reason)` /
`Superseded by CR-XXX`. Fix sessions update this line; never delete tickets.

Out-of-territory observations: file a stub ticket (Where + What only) tagged
with the session that owns that territory, so it's waiting for them.

---

## System Map *(each session fills in its territory)*

Goal: a holistic picture of how systems connect, built up across sessions.
For each system note: **state it owns** (paths in GameState), **events
published**, **events subscribed**, **who calls it / what it calls**. Flag
contract mismatches (publisher payload ≠ subscriber expectation) as tickets.

### Session 1 — State core *(reviewed 2026-07-17)*

**GameState / StateSchema** (`src/state/`)
- Owns: the entire `state` tree (singleton). Save shape: `{ version, savedAt, state }`.
- Real card data post-rework lives in `areaStates[areaId].deckSlots` (slim
  flyweight slots — verified clean: templateId + slot metadata + runtime
  counters only) and in LoopRunner's runtime-only `_activeCards` map.
  `state.cards` holds only `idCounter`. The old `cards.active`/`cards.library`
  arrays no longer exist anywhere (see CR-007/CR-018).
- Rehydration on load: cards steps are no-ops (CR-007); heroes get
  `aggregator` + display fields reattached via `HeroRehydration.rehydrateHero`
  + equipment modifier recalc. Verified: `ModifierAggregator` holds only
  Maps/Sets of plain data — `structuredClone` in `serialize()` cannot throw.

**SaveManager / SaveMigration / SaveSlotHelper** (`src/systems/core/`)
- 3 localStorage slots (keys have a trailing space — CR-013). Autosave timer
  + beforeunload save. `migrateState` hard-refuses any version ≠ 0.2.0 via
  `IncompatibleSaveError` — matches the locked no-migration decision ✓.
- Publishes: `game_saved`, `game_loaded` (payload `savedAt` feeds TimeBank
  offline accrual — contract coherent ✓), `game_started`.
- Subscribes: `settings_updated` → autosave interval (boot-order bug CR-004).
- `validateSaveData` exists but is never called on the load path (CR-008).

**EventBus / EventBatch / areaEvents**
- Plain Map<name, Set<cb>> pub/sub; per-subscriber try/catch isolation ✓.
- EventBatch coalesces `inventory_updated`/`heroes_updated`/`cards_updated`/
  `state_changed` during engine ticks via a publish-intercept sink. Verified:
  both users (LoopRunner.tick, StationManager.tick) pair begin/flush in
  try/finally — crash-safe ✓. Dedupe key includes `payload.areaId`.
- `areaEvents.js` documents the 10 `area:*` scoped events (Session 2 should
  verify publisher/subscriber payloads against this registry).

**GameLoop / TimeManager / TimeBankManager**
- setInterval loop @ TICK_INTERVAL_MS=100 (10 t/s). 9 tick handlers, all
  registered by EngineBootstrap at default priority 100 — execution order is
  registration order via stable sort (CR-016): time_tracking → regen →
  loop_runner → station_manager → time_bank → quest_board → wounded →
  status_effects → consumable(1s gate).
- Canonical game clock is `state.time.gameTimeMs` (advanced by the
  time_tracking handler). TimeManager keeps a parallel unsaved counter —
  dead (CR-014). Time scale (TimeBank fast-forward) multiplies delta at the
  TimeManager level, so all systems see scaled ms uniformly.
- TimeBank: accrues (now − savedAt) on `game_loaded`, capped at
  TIME_BANK.MAX_MS; drains by scaled delta while spending; publishes
  `time_bank_updated` (UI refresh throttled to every 10 drain ticks) ✓.

**EngineBootstrap**
- `init()` → system .init() subscriptions; `onSlotSelected()` → manager
  inits, `ensureAreaState` per unlocked area, GameLoop.start, initial UI
  sync events. `getEngine()` is the DI object handed to React.
- `createDefaultGameData` writes legacy `GameState.exploration` (CR-015).

**NotificationSystem / NotificationSubscriptions / SettingsManager**
- Notifications: module-level queue, aggregation keys, per-category
  durations from SettingsManager; publishes `notification_added/updated/
  dismissed`. Subscriptions module wires hero/inventory/currency events →
  toasts + a 10s rate heartbeat (CR-017 minor issues).
- SettingsManager: localStorage `fantasy_guild_settings`, dot-path get/set,
  publishes `settings_updated` on save() only — not on load() (CR-004).
  The `state.settings` section in StateSchema is a drifted duplicate
  (CR-011).

**AudioSystem / DiscoveryManager / AssetPreloader**
- AudioSystem subscribes to several dead/renamed events and maps clips that
  are never resolvable (CR-005, CR-010). DiscoveryManager: enemy discovery
  on combat events → `enemy_discovered` + `state_changed` ✓.
- AssetPreloader gates boot on a "critical" regex that still includes the
  retired `assets/playmat/` directory (CR-009).

### Session 2 — Loop engine
*(not yet reviewed)*

### Session 3 — Combat, heroes & status effects
*(not yet reviewed)*

### Session 4 — Cards, collection, economy & quests
*(not yet reviewed)*

### Session 5 — UI ↔ engine boundary
*(not yet reviewed)*

### Session 6 — UI components
*(not yet reviewed)*

---

## Findings

### Pre-filed during planning (2026-07-16)

### CR-001 · P2 · L · Session 6 · Status: Open
- **Where**: src/ui/components/banner/AreaBannerRow.jsx (~1,665 lines)
- **What**: Largest file in the codebase; likely mixes several
  responsibilities (row layout, split-banner center, station controls, focus
  morphing).
- **Why it matters**: Hard to change safely; every banner feature touches it.
- **Suggested fix**: Session 6 assesses whether it splits along natural seams
  (per the judgment-based standard — split only if responsibilities are
  genuinely mixed).

### CR-002 · P1 · M · Session 3 · Status: Open
- **Where**: src/systems/cards/logic/CombatProcessor.js
- **What**: Combat's internal pacing may not scale correctly under large time
  deltas (Time Bank acceleration) — fights don't speed up proportionally.
- **Why it matters**: Spending banked time is less valuable while a hero is
  in combat; players would notice the discrepancy.
- **Related**: Roadmap Phase 8 notes (known caveat, flagged 2026-07-08).
- **Confidence**: Reported but not isolated — Session 3 should trace the
  pacing math; Session 7 can verify under a 10x scale.

### CR-003 · P2 · S · Session 8 · Status: Open
- **Where**: package.json (dnd-kit deps) vs src/ui/dnd/
- **What**: Two drag systems coexisted during the DnD migration (dnd-kit and
  nativeDrag). Phase 9 (2026-07-17) deleted nativeDrag.js, the old
  DndProvider, and systems/dnd/ — remaining scope: audit that all four
  @dnd-kit packages in package.json are actually used by DndKit.jsx
  (e.g. @dnd-kit/sortable may be unused).
- **Why it matters**: Dead dependencies bloat the bundle headed for Tauri.

### Session 1 findings

### CR-004 · P1 · S · Session 1 · Status: Open
- **Where**: src/main.jsx:50-51, src/systems/core/SaveManager.js:44/61-76,
  src/systems/core/SettingsManager.js:74-91
- **What**: `SaveManager.init()` runs before `SettingsManager.init()`, so it
  reads the *default* autosave interval (10 min), not the player's stored
  one. `SettingsManager.load()` doesn't publish `settings_updated`, so the
  stored value is only applied after the player touches any setting.
- **Why it matters**: A player who set autosave to 1 minute silently gets
  10-minute autosaves every session until they open the settings panel —
  up to 10 minutes of lost progress on a crash.
- **Suggested fix**: Swap the two init calls in main.jsx (SettingsManager
  first), or have `load()` publish `settings_updated`.

### CR-005 · P1 · M · Session 1 · Status: Open
- **Where**: src/state/StateSchema.js:145 (`ui.activeAreaId`),
  src/systems/core/AudioSystem.js:39, plus 8 read sites
- **What**: The "active area" concept is orphaned: `ui.activeAreaId` is read
  in 8 places but **never written** anywhere, and the `area_switched` event
  has 3+ subscribers (AudioSystem BGM switching, ChaosTracker, BonusModal
  re-render hints) but **zero publishers**.
- **Why it matters**: Background music can never change from the guild-hall
  track; systems that key off the active area (MasterySystem.js:145,
  CardHeaderModule, ThreatModule) operate on a value frozen at
  `area_guild_hall` — behavior silently pinned to one area.
- **Suggested fix**: **Ask the owner first** — post-rework, is there still a
  single "active area" (e.g. the focused banner row), or should per-area
  BGM/logic be redesigned or removed? Then either wire a real publisher or
  delete the field, the event, and its consumers.
- **Related**: CR-010 (other dead audio wiring), CR-019 (UI consumers).
- **Confidence**: Greps are conclusive for "never written/never published";
  the *intended* design needs an owner decision.

### CR-006 · P2 · S · Session 1 · Status: Open
- **Where**: src/state/StateSchema.js:23, src/systems/core/SaveSlotHelper.js:38
- **What**: `meta.totalPlaytime` is initialized but never incremented by
  anything; `meta.lastSavedAt` is likewise never written (slot UI falls back
  to the save wrapper's `savedAt`, which works).
- **Why it matters**: The save-slot screen shows 0 playtime forever on every
  slot — visibly broken to the player on the very first screen.
- **Suggested fix**: Accumulate playtime in the `time_tracking` tick handler
  (EngineBootstrap.js:118) or stamp it at save time; delete `lastSavedAt`
  or write it in `serialize()`.

### CR-007 · P2 · M · Session 1 · Status: Open
- **Where**: src/state/GameState.js:13-18 (CARD_PROPS_TO_STRIP), 47-71
  (_rehydrateAll card steps), 134-144 (card cache), 174-187 (serialize strip)
- **What**: The card flyweight machinery operates on `cards.active` /
  `cards.library` arrays that no longer exist post-rework (state.cards holds
  only `idCounter`; nothing anywhere creates those arrays). Consequences:
  the strip list strips nothing, the card rehydration steps are no-ops, and
  `_cardById` is never populated (`cacheCard` has zero callers), so
  `getCardById` always returns null.
- **Why it matters**: Dead machinery in the most safety-critical file in the
  game misleads every future reader about where card data lives; ~20 call
  sites of `getCardById` silently receive null (see CR-018 for whether those
  callers are themselves dead).
- **Suggested fix**: After CR-018 settles which callers are dead, delete the
  cache, the strip list, and the card steps of `_rehydrateAll`; document
  that deck slots + LoopRunner `_activeCards` are the only card carriers.
- **Related**: CR-018; roadmap Phase 9 (this survived the sweep).

### CR-008 · P2 · S · Session 1 · Status: Open
- **Where**: src/systems/core/SaveManager.js:144-179 (loadSlot),
  src/state/StateSchema.js:170 (validateSaveData)
- **What**: `validateSaveData` (70 lines of careful structural checks,
  including deck-slot shape) is only ever called by a test — the real load
  path parses, version-checks, top-level-merges, and rehydrates without it.
- **Why it matters**: A structurally corrupted save (truncated write, manual
  edit) reaches rehydration and fails deep inside game code with a generic
  "Save Corrupted" — or worse, loads and misbehaves later. The guardrail
  exists; it's just not plugged in.
- **Suggested fix**: Call it in `loadSlot` after migrate; refuse (or at least
  console-log the specific errors) on invalid.

### CR-009 · P2 · S · Session 1 · Status: Open
- **Where**: src/systems/core/AssetPreloader.js:18 (CRITICAL_RE),
  public/assets/playmat/ (still shipped)
- **What**: The boot gate's "critical art" regex still lists the retired
  `assets/playmat/` directory, and the playmat art folder still exists in
  public/assets.
- **Why it matters**: Boot waits (up to the 4s timeout) on warming art the
  game never renders; dead art ships in the Tauri bundle.
- **Suggested fix**: Point CRITICAL_RE at the actual first-screen art of the
  deck-loop UI (backgrounds/heroes/icon; add banner art dirs as needed);
  deleting the folder itself is Session 8's bundle-audit call.
- **Related**: CR-003 (Session 8 bundle audit).

### CR-010 · P2 · S · Session 1 · Status: Open
- **Where**: src/systems/core/AudioSystem.js:44-53 (subscriptions), 163-188
  (clip map); publishers at src/systems/project/ProjectManager.js:137,
  src/ui/components/card-modules/RecipeSelectorModule.jsx:69
- **What**: Audio contract drift, four kinds: (1) published clips missing
  from the clip map — `project_complete`, `assign` → warn log, no sound;
  (2) subscriptions with no publisher — `skill_leveled`, `task_completed`;
  (3) hover-contextual SFX keyed to `audio:focus_changed` from GICard.jsx —
  possibly a playmat-era hover concept (Session 6 to confirm GICard is
  live); (4) BGM switching dead via CR-005.
- **Why it matters**: Crafting/recipe actions are silently mute; dead
  subscriptions mislead about what sounds exist.
- **Suggested fix**: Add the two missing clips to the map (or fix publisher
  clip names); delete dead subscriptions once Sessions 3/6 confirm the
  events are gone for good.

### CR-011 · P2 · S · Session 1 · Status: Open
- **Where**: src/state/StateSchema.js:27-46 (settings section),
  src/state/GameState.js:150-164 (updateMeta/updateSettings)
- **What**: `state.settings` in the schema is a drifted duplicate of the
  real settings (SettingsManager/localStorage): wrong keys
  (`autoSaveInterval` seconds vs `autoSaveIntervalMinutes`), wrong scales
  (volume 0–1 vs 0–100). The `updateSettings` and `updateMeta` mutators
  have zero callers.
- **Why it matters**: Two "settings" sources of truth in the codebase; the
  schema one is saved into every save file but never read — a trap for any
  future feature that reaches for it.
- **Suggested fix**: Delete `state.settings` from the schema (settings are
  device-local by design) and the two dead mutators; or, if settings should
  roam with the save, migrate SettingsManager to read/write state — owner
  choice, but pick one.

### CR-012 · P3 · S · Session 1 · Status: Open
- **Where**: src/state/GameState.js:174-187 (serialize),
  src/systems/hero/logic/HeroRehydration.js:14-42
- **What**: Heroes are serialized whole — runtime `aggregator` (JSON-
  stringifies to an empty husk), derived `className`/`traitName`/`level`/
  `_rev` all land in the save file. Harmless (rehydrateHero overwrites on
  load) but asymmetric with the card flyweight discipline.
- **Suggested fix**: A `HERO_PROPS_TO_STRIP` mirroring the card list.

### CR-013 · P3 · S · Session 1 · Status: Open
- **Where**: src/systems/core/SaveSlotHelper.js:10
- **What**: Slot localStorage keys have a trailing space
  (`"fantasy_guild_slot_0 "`), as do several notification strings.
- **Why it matters**: Sticky trap — "fixing" the key later orphans every
  existing save unless the fix migrates the key. Document or fix
  deliberately (with a key migration), never casually.

### CR-014 · P3 · S · Session 1 · Status: Open
- **Where**: src/systems/core/TimeManager.js:21/77/148-153,
  src/systems/core/GameLoop.js:37
- **What**: TimeManager keeps a parallel `gameTime` counter that resets to 0
  every boot (`GameLoop.start()` calls `TimeManager.init()` bare); its
  `getGameTime`/`serialize` have no callers. The canonical clock is
  `state.time.gameTimeMs`. Also `state.time.isPaused` is saved but never
  synced from TimeManager, so pause state doesn't survive a reload.
- **Suggested fix**: Delete the dead counter + serialize; decide whether
  pause should persist (probably not — then drop the schema field).

### CR-015 · P3 · S · Session 1 · Status: Open
- **Where**: src/systems/core/EngineBootstrap.js:188-191
- **What**: `createDefaultGameData` writes `GameState.exploration = {count:0}`
  onto the singleton *manager object* (not into state); nothing reads it.
  Comment admits it's "legacy exploration state".
- **Suggested fix**: Delete the block.

### CR-016 · P3 · S · Session 1 · Status: Open
- **Where**: src/systems/core/EngineBootstrap.js:117-175,
  src/systems/core/GameLoop.js:92-96
- **What**: Every tick handler registers at default priority 100; the
  comments say ordering matters (regen before loop_runner, etc.) but it's
  actually guaranteed only by registration order + stable sort, while the
  priority parameter goes unused.
- **Suggested fix**: Pass explicit priorities (10, 20, 30…) so the intended
  order is stated in code, not implied by call order.

### CR-017 · P3 · S · Session 1 · Status: Open
- **Where**: src/systems/core/NotificationSubscriptions.js:7-8,
  src/systems/core/NotificationSystem.js:125-135
- **What**: (a) Module-level `const queue = NotificationSystem.getQueue()`
  grabs a stale copy that's never used (handlers correctly re-fetch); the
  comment claims it's the "shared queue" — it isn't (getQueue returns a
  copy). (b) The over-max trim loop computes `normalToasts` once and tests
  its stale length as the loop condition — works, but only by accident of
  the `findIndex` break.
- **Suggested fix**: Delete the dead const + fix the comment; recompute the
  trim condition inside the loop.

### CR-018 · P2 · M · Session 4 (stub, filed by Session 1) · Status: Open
- **Where**: src/systems/cards/logic/LookupProcessor.js,
  CardManagerUtils.js, LifecycleProcessor.js, TransformationProcessor.js,
  ProjectProcessor.js; src/systems/project/ProjectManager.js:86/127;
  src/systems/effects/AuraManager.js:20;
  src/systems/progression/MasterySystem.js:187/212
- **What**: All of these query `cards.active`/`cards.library` (arrays that
  no longer exist) or `GameState.getCardById` (cache never populated —
  always null). Session 4 must determine, per caller: dead code to delete,
  or live feature silently broken post-rework.
- **Related**: CR-007.

### CR-019 · P2 · S · Session 5/6 (stub, filed by Session 1) · Status: Open
- **Where**: src/ui/components/base/ProgressBar.jsx:151 (cards.active
  fallback), src/ui/components/base/GICard.jsx:59/93 (audio focus events),
  src/ui/components/hud/ChaosTracker.jsx + src/ui/modals/BonusModal.jsx
  (`area_switched` re-render hints), CardHeaderModule.jsx:19 +
  ThreatModule.jsx:14 (frozen activeAreaId reads)
- **What**: UI-side consumers of the dead state/events found in CR-005/
  CR-007/CR-010 — assess live vs. legacy in the UI sessions.
- **Related**: CR-005, CR-007, CR-010, CR-018.

### Session 2 findings
*(none yet)*

### Session 3 findings
*(none yet)*

### Session 4 findings
*(none yet)*

### Session 5 findings
*(none yet)*

### Session 6 findings
*(none yet)*

### Session 7 findings
*(none yet)*

### Session 8 findings
*(none yet)*
