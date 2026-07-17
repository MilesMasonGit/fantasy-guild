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
| 2 | Loop engine | ✅ Done (2026-07-17) | 6 tickets (CR-020–CR-025); 1×P1 (combat escape loophole), 2×P2, 3×P3. Engine architecture verified sound. |
| 3 | Combat, heroes & status effects | ✅ Done (2026-07-17) | CR-002 root cause found; 9 tickets (CR-026–CR-034); 5×P2 (2 need owner decisions), 4×P3. Status engine + formulas verified sound. |
| 4 | Cards, collection, economy & quests | ⬜ Not started | |
| 5 | UI ↔ engine boundary | ⬜ Not started | |
| 6 | UI components | ⬜ Not started | |
| 7 | Runtime verification (hands-on) | ⬜ Not started | Requires 1–6 |
| 8 | Build, Tauri readiness & synthesis | ⬜ Not started | Goes last |

**Next ticket ID:** CR-035

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

### Session 2 — Loop engine *(reviewed 2026-07-17)*

**LoopRunner** (`src/systems/loop/LoopRunner.js`, 613 lines — large but
cohesive; no split proposed under the judgment standard)
- Owns: per-area loop execution over `areaStates[areaId]` (status machine
  paused/drawing/running/in_combat/shuffling/injured, `executionTimer`,
  `activeCardIndex`), plus the runtime-only `_activeCards` map (ephemeral
  card instances — never saved; rebuilt on demand after load ✓, verified
  for both mid-task and mid-combat load recovery).
- Publishes (batched): `area:status_changed`, `area:card_completed`,
  `area:combat_resolved`, `area:mode_switched`; (unbatched, throttled to
  every 3rd tick): `area:progress` — combat variant adds an
  `enemyPercent` field not documented in areaEvents.js (CR-025).
- Subscribes: `area:stats_dirty` (loop reset — discards ephemeral card,
  pauses; **no in_combat guard → CR-020**), `hero_recovered`.
- Calls: CardFactory, WorkProcessor, StatProcessor, RequirementProcessor,
  CombatProcessor (delegated per-tick while in_combat), HeroManager,
  EquipmentManager, StatusEffectSystem, InventoryManager.
- Fast-path verified: common tick is timer decrement + throttled progress
  event; only minor per-tick allocations (CR-023). EventBatch begin/flush
  in try/finally ✓.

**StationManager** (crafting tick engine)
- Ticks `stationState` for stationed areas: input gate each tick, energy
  paid per cycle start (station Drink auto-sip fallback), deduct/deposit
  at completion, XP award, production cap. Statuses: idle/crafting/
  paused_no_inputs/paused_limit_reached/paused_no_energy (last one missing
  from the file-top doc comment — CR-025).
- Publishes: `area:status_changed`, `area:craft_completed`,
  `area:station_changed` (drink depletion), `area:progress`,
  batched `inventory_updated`/`heroes_updated`.
- Tag-input recipes rescan the whole bank every tick (CR-023).

**DeckSlotManager** (card movement API)
- Enforces: ownership (playsets), Single-Copy Rule per deck, specialized
  tags, locked/hazard slots, availability across areas (computed view —
  never persisted ✓). `reconcileOwnership()` self-heal at boot/load ✓.
- Publishes `area:deck_updated`; every mutation calls `resetAreaLoop`
  (→ CR-020: no in_combat guard).

**StationSlotManager / AreaModifiers**
- Station slot + recipe selection + drink slot + passive-buff registry.
  Area ModifierAggregators are runtime-only (module Map), rebuilt via
  `rehydrateBuffs()` on boot + `game_loaded` ✓ — clean flyweight pattern.
- Publishes `area:station_changed`, `area:mode_switched` (unslot path).

**ModeManager**
- Adventure↔stationed toggle. Correctly refuses stationed-retreat
  mid-combat and adventure-return while injured ✓ (contrast CR-020).

**HeroAssignmentManager** (`src/systems/area/`)
- Hero↔area binding (one hero per area), Loop Reset Rule owner
  (`resetAreaLoop` publishes `area:stats_dirty`), equipment-change leg via
  `hero_equipment_changed` subscription. Auto-swap displace path skips
  `unassignHero`'s cleanup (CR-021).

**loopConstants.js** — all engine tunables in one place ✓. Documents the
locked Time-Bank decisions: 10x preset cap (so every ≥1s action still gets
≥1 tick) and the "approximate" drain accounting. CR-022 quantifies the
overshoot cost inside that approximation.

**Area-event contract audit** (requested by Session 1): all 10 events in
areaEvents.js have live publishers with payloads matching the registry
docs; only gap is the undocumented `enemyPercent` on `area:progress`
(CR-025). No orphaned area events found.

### Session 3 — Combat, heroes & status effects *(reviewed 2026-07-17)*

**Combat chain** (`src/systems/cards/logic/`)
- `CombatProcessor.processCombat(card, trait, delta)` — driven per-tick by
  LoopRunner while an area is `in_combat`, operating on the ephemeral card.
  Sub-processors: CombatAttackProcessor (hit/damage rolls, on-hit statuses,
  thorns, durability), CombatResolutionProcessor (victory XP/loot/horde/
  dungeon branches, wounded handling, auto-eat).
- Publishes: `combat_hero_attack`, `combat_enemy_attack`, `combat_victory`,
  `combat_consumed`, `combat_enemy_trait_trigger`. LootSystem and
  DiscoveryManager subscribe to these ✓ payloads coherent.
- **Works-by-accident caveat**: every CardManager-mediated call inside
  combat (setCardStatus, unassignHero, revertFromCombat, the
  combat_victory→getCard subscriber) silently no-ops through the dead card
  cache (CR-028); fights function only via direct card mutation.
- Horde/dungeon/invasion branches are unreachable from the deck loop
  (DECK_SLOTTABLE_TYPES = task/combat/consumable) — dormant, not dead-by-
  design (§J deferred systems).
- CR-002's pacing bug root-caused here (see CR-002 addendum).

**CombatFormulas / FormulaRegistry** — verified against
combat_formula_spec.md §7: hit pipeline (75 + 0.25·Δskill + acc − block ±
RPS 7, clamp 5–95), damage (4·G(skill) + weapon ± spread ± RPS 10%, min 1),
growth G(L)=1.045^(L−1), enemy budgets, DEFENSE_XP_SHARE=⅓ ✓ all match.
Crit/Armor/weapon-speed are documented hooks (deferred pass). All tunables
centralized ✓. Deprecated legacy constants clearly marked.

**StatusEffectSystem** (`src/systems/effects/`) — the good citizen:
5s global clock carries its remainder correctly (the pattern combat
should copy). Hero statuses persisted on `hero.statuses` ✓, enemy statuses
ephemeral on `card.combat.enemyStatuses` ✓. Decay triggers (tick /
attack_attempt / hit_taken / combat_resolved / slot_resolved) all have
live callers. Subscribes `area:card_completed` for slot-decay ✓.
Minor: CR-034.

**Dead effects subsystem**: EffectEngine + AuraManager (aura "grid pulse"
over nonexistent cards.active) + EffectProcessor (applyTaskEffects /
calculateSpeedModifier — zero callers) are playmat-era and fully dead
(CR-027), though still exported on the Engine object.

**Hero systems** (`src/systems/hero/`)
- HeroManager = thin dispatcher over logic/ modules (Lifecycle, Lookup,
  Roster, State, Rehydration). Hero shape: skills(15)/hp/energy/status/
  statuses/equipment(weapon,armor,food,drink)/aggregator(runtime).
- Publishes: `hero_recruited`, `hero_retired`, `hero_benched`,
  `hero_activated`, `hero_leveled` (SkillSystem), `heroes_updated` (many).
- getHero has a rehydration failsafe (rebuilds lost aggregator) ✓.
- **Gap**: bench/retire only clear legacy assignedCardId, not the area
  assignment (CR-026). getAllHeroes returns active roster only — bench
  excluded from status ticks/regen (see CR-034 note).
- SkillSystem: XP funnels sub-skill→parent ✓, level from XPCurve, modifiers
  reapplied on level-up ✓. console.log spam (CR-032).
- RegenSystem: chunked 1 HP+1 Energy per 5s to idle/working/combat heroes;
  remainder-carrying timers ✓.
- WoundedSystem: 5-min recovery on wall-clock Date.now (CR-033 — ignores
  time-scale), recovers at 50% HP, publishes `hero_recovered` which
  LoopRunner uses to leave 'injured' ✓.

**LootSystem** (`src/systems/combat/`) — cluster-based weighted drops;
subscribes `combat_victory`; task rewards route through it with status
yield buffs (probabilistic rounding ✓) and mastery doubles. Sound.

**Requirement chain** — RequirementProcessor/Registry validate heroslot /
skill / inputslot / toolslot / dynamic_inputslots traits; used live by
LoopRunner (slot skip) and WorkProcessor. The card-instance-heavy branches
(assignedItems, card.stack, projects) are legacy-shaped but harmless for
loop cards. WorkProcessor.processWorkCycle + QuestProcessor.processQuest
have **no callers** (loop calls completeWorkCycle directly) — CR-027.

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
- **Root cause (Session 3, 2026-07-17 — confirmed by code reading)**: attack
  accumulators are *reset to zero* on fire instead of subtracting the
  interval — src/systems/cards/logic/CombatAttackProcessor.js:36/74 (hero)
  and :91/:128 (enemy), plus the intermission timer clamp in
  CombatProcessor.js:59. Effective attack interval therefore rounds UP to a
  whole number of engine ticks. Invisible at 1x (100ms ticks); at 10x each
  tick is 1000ms of game-time, so the hero's 2500ms attack fires every
  3000ms (−17% DPS) and worst-case intervals lose ~40%. Fix: subtract the
  interval (`acc -= attackSpeed`) and carry intermission overshoot — same
  remainder-carry pattern StatusEffectSystem.tick already uses correctly.
  Same family as CR-022 (loop-phase timers); fix and measure together
  (Session 7, 10x scale).

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
- **Suggested fix**: ~~Ask the owner first~~ **Owner decision (2026-07-17)**:
  the single "active area" concept is retired — areas are now added/removed
  from the visible list freely; per-area music is deferred to later
  implementation; "active area" will likely be reinterpreted as a toggle
  for which areas are shown on the playmat. Fix direction: remove the
  frozen `ui.activeAreaId` single-value semantics and the `area_switched`
  event + its subscribers; when the show/hide-areas toggle is built, give
  it its own state shape and event. Don't build per-area BGM now.
- **Related**: CR-010 (other dead audio wiring), CR-019 (UI consumers).

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

### CR-020 · P1 · S · Session 2 · Status: Won't fix (owner decision
2026-07-17: instant escape is intentional — casual idle design; combats run
hundreds of times and heroes are built to not lose, so free disengage via
deck/hero/equipment edits is the intended pressure valve). **Follow-up
worth deciding later**: `pauseArea` (LoopRunner.js:615) and the mode toggle
(ModeManager.js:50) still *refuse* mid-combat — now inconsistent with this
intent; consider relaxing those guards so the obvious buttons offer the
same escape the workarounds do (downgrade to P3 polish).
- **Where**: src/systems/loop/LoopRunner.js:87-99 (STATS_DIRTY handler),
  src/systems/loop/DeckSlotManager.js:164/186/219,
  src/systems/area/HeroAssignmentManager.js:91/111/130
- **What**: Any deck edit (slot/unslot/swap), hero reassignment, or
  equipment change during an active fight aborts the combat with **no
  Forced Retreat penalty** — `resetAreaLoop` has no in_combat guard, and
  LoopRunner's stats-dirty handler obediently discards the fight and
  pauses. Meanwhile `pauseArea` (LoopRunner.js:615) and the mode toggle
  (ModeManager.js:50) explicitly *refuse* mid-combat, with a comment saying
  escaping a fight is exactly what the §3F penalty exists to price.
- **Why it matters**: A player about to lose a fight (and its gear-loss /
  consumable-loss penalties) can escape free by unslotting any card or
  swapping their hero — undermines the entire death-penalty economy.
- **Suggested fix**: **Owner decision needed on flavor**: either (a) refuse
  deck/hero/equipment changes for an area while it's in_combat (consistent
  with pauseArea), or (b) allow them but route through `_forcedRetreat`
  pricing. (a) is simpler and matches existing guards.
- **Related**: concept doc §10B, roadmap §3F.

### CR-021 · P2 · S · Session 2 · Status: Open
- **Where**: src/systems/area/HeroAssignmentManager.js:83-87
- **What**: When assigning a hero to an area that already has one, the
  displaced hero is nulled out directly instead of going through
  `unassignHero` — so they skip the status-effect cleanse (§3B: "exiting
  the run clears all statuses") and, if displaced mid-fight, keep a stale
  `hero.status === 'combat'` forever (nothing else resets it).
- **Why it matters**: Displaced hero can carry DoTs/debuffs (or a stuck
  "in combat" status) onto the bench and into their next assignment.
- **Suggested fix**: Call `unassignHero(areaId)` for the displaced hero
  before assigning the new one (it already does the cleanup correctly).

### CR-022 · P2 · S · Session 2 · Status: Open
- **Where**: src/systems/loop/LoopRunner.js:164/169/177 (timer decrements),
  _beginDraw/_activateSlot/_advance (timer resets)
- **What**: When a phase timer crosses zero, the overshoot is discarded —
  the next phase starts at its full duration instead of absorbing the
  remainder. At normal speed the loss is ≤100ms per transition (invisible);
  at 10x fast-forward each tick is 1000ms of game-time, so up to ~1s of
  *banked* time evaporates per transition — on a short-cycle deck roughly
  5–10% of the bank's value.
- **Why it matters**: Banked time (the Phase 8 headline feature) quietly
  buys less than advertised at higher multipliers; same family as CR-002.
- **Suggested fix**: Carry the remainder (`timer += nextDuration` instead
  of `timer = nextDuration`). Note loopConstants.js documents the drain
  accounting as owner-approved "approximate" — confirm with the owner
  whether this precision is wanted before fixing.
- **Related**: CR-002 (combat pacing under time scale); Session 7 should
  measure both together at 10x.

### CR-023 · P3 · S · Session 2 · Status: Open
- **Where**: src/systems/loop/LoopRunner.js:149,
  src/systems/loop/StationManager.js:235-244 (_resolveTagInput)
- **What**: Minor tick-path allocations (objective 3): a literal array is
  allocated per area per tick for the status check, and tag-input recipes
  call `Object.entries` over the whole item bank every tick (10×/s per
  crafting area).
- **Why it matters**: Small today; the kind of GC churn that grows with
  bank size and area count. Cheap to fix.
- **Suggested fix**: Hoist the status array to a module const; cache tag→
  itemId resolution and invalidate on `inventory_updated`.

### CR-024 · P3 · S · Session 2 · Status: Open
- **Where**: areaState `_dirtyStats`/`_activeDuration`,
  stationState `_craftDuration` (written by LoopRunner/StationManager,
  persisted via GameState.serialize)
- **What**: Underscore-prefixed runtime fields are saved into every save
  file. Harmless today (consumed or overwritten on load) but they're
  runtime scratch state leaking into the persistence layer.
- **Suggested fix**: Strip `_`-prefixed keys from areaStates in
  `serialize()`, or document them as intentionally persisted.
- **Related**: CR-012 (same asymmetry for heroes).

### CR-025 · P3 · S · Session 2 · Status: Open
- **Where**: src/systems/loop/LoopRunner.js:53-54 (comment),
  LoopRunner.js:417-419 (comment), src/systems/loop/DeckSlotManager.js:34,
  src/systems/core/areaEvents.js:35, src/systems/loop/StationManager.js:29-33
- **What**: Doc/consistency residue: (a) comment cites
  systems/combat/CombatTickProcessor — deleted in Phase 9; (b) comment says
  "no consumable card templates exist yet" — data/cards/consumable/
  consumables.json exists now; (c) `'consumable'` is a string literal
  because CARD_TYPES has no CONSUMABLE entry; (d) `area:progress` combat
  payload's `enemyPercent` is undocumented in areaEvents.js; (e)
  StationManager's status-machine comment omits `paused_no_energy`.
- **Suggested fix**: One small comment/constants cleanup pass.

### Session 3 findings

*(CR-002's root cause was also identified this session — see the addendum
on CR-002 under the pre-filed findings.)*

### CR-026 · P2 · S · Session 3 · Status: Open
- **Where**: src/systems/hero/logic/HeroRoster.js:11-29 (moveHeroToBench),
  src/systems/hero/logic/HeroLifecycle.js:63-100 (retireHero);
  compensating UI at src/ui/components/drawer/HeroInspection.jsx:78/190;
  uncompensated caller at src/ui/components/HeroIdentityStrip.jsx:50
- **What**: Benching or retiring a hero never clears their deck-loop area
  assignment at the engine level — both functions only handle the legacy
  `hero.assignedCardId` (always null post-rework, and routed through the
  dead AssignmentSystem anyway). The hero drawer manually unassigns first,
  but the HeroIdentityStrip right-click bench path doesn't.
- **Why it matters**: A ghost assignment: `areaState.assignedHeroId` points
  at a benched (or deleted) hero, the loop keeps running them through
  slots — a retired hero leaves the area half-functional, and a benched
  hero adventures from the bench.
- **Suggested fix**: Inside moveHeroToBench/retireHero, call
  `HeroAssignmentManager.unassignHero(getAreaForHero(heroId))` — engine
  enforces its own invariant instead of trusting every UI caller.
- **Confidence**: The engine hole is certain. Whether HeroIdentityStrip is
  still a live component needs Session 6 (it reads legacy fields and a
  "Tavern open" flag — may itself be dead; CR-019 family).

### CR-027 · P2 · M · Session 3 · Status: Open
- **Where**: src/systems/effects/EffectEngine.js, AuraManager.js,
  EffectProcessor.js; src/systems/cards/logic/WorkProcessor.js:23
  (processWorkCycle), QuestProcessor.js:12 (processQuest)
- **What**: The playmat-era adjacency/aura effects subsystem is entirely
  dead: EffectEngine.pulse's only caller is CardManagerUtils (itself
  CR-018), AuraManager pulses over the nonexistent `cards.active`, and
  EffectProcessor's two exports have zero callers. Likewise
  `processWorkCycle` (the incremental tick half of WorkProcessor) and
  `processQuest` have no callers — the loop enters at completeWorkCycle.
  EffectProcessor and the dead exports are still handed to the UI on the
  Engine object.
- **Why it matters**: ~450 lines of dead machinery in the systems layer,
  exported as if live — high confusion cost for future feature work
  ("do areas have adjacency bonuses? the code says yes").
- **Suggested fix**: Delete alongside CR-018's sweep (Session 4 confirms
  CardManagerUtils' fate first); remove EffectProcessor from getEngine().
- **Related**: CR-007, CR-018.

### CR-028 · P2 · S · Session 3 · Status: Open
- **Where**: src/systems/cards/logic/CombatProcessor.js:32/67,
  CombatResolutionProcessor.js:24-25/88/117-128
- **What**: Combat's card-state transitions route through the never-
  populated card cache and silently no-op: the card is never marked
  'active' during a fight (stays 'idle'; victory only works because
  handleVictory writes `card.status` directly), handleHeroWounded's
  unassign no-ops, revertFromCombat no-ops, and the combat_victory
  subscriber's horde-quest block is dead.
- **Why it matters**: Anything (UI, future code) reading the ephemeral
  card's status mid-fight sees the wrong value, and the fight only works
  by accident of the direct-mutation paths. Fragile foundation for the
  planned crit/armor/weapon passes.
- **Suggested fix**: For ephemeral loop cards, set `card.status` directly
  (or route through a LoopRunner-aware helper); delete the dead branches
  with CR-018.
- **Related**: CR-007, CR-018.

### CR-029 · P2 · M · Session 3 · Status: Open — **owner decision needed**
- **Where**: src/config/registries/equipmentConstants.js:5-10,
  src/ui/components/drawer/HeroInspection.jsx:142 (renders food/drink
  gear slots), src/systems/equipment/ConsumableSystem.js (1s auto-consume
  tick via EngineBootstrap.js:165), CombatResolutionProcessor.js:91-114
  (in-combat auto-eat), loopConstants GEAR_LOSS_EXEMPT_SLOTS,
  hero.lastEatenAt/lastDrunkAt
- **What**: The 2026-07-16 station/consumables redesign retired hero
  food/drink slots (station Drink slot took over), but the code still
  fully supports them end-to-end: the slots exist, the drawer renders
  them equippable, ConsumableSystem auto-eats every second, and combat
  has its own auto-eat path.
- **Why it matters**: Either a retired mechanic is still live (players
  can still equip/auto-eat food — contradicting the redesign), or this
  is all residue awaiting deletion. Two parallel sustain systems confuse
  balance tuning either way.
- **Suggested fix**: Owner call: are hero-carried food/drink still a
  mechanic? If retired: remove the slots, ConsumableSystem, both auto-eat
  paths, and the constants. If kept: update the design memory/docs.

### CR-030 · P3 · S · Session 3 · Status: Open
- **Where**: src/systems/cards/logic/CombatAttackProcessor.js:126
- **What**: Every enemy hit rolls 25% durability damage against 'head',
  'body', 'hands', 'feet' — slots that don't exist (EQUIPMENT_SLOTS is
  weapon/armor/food/drink). Four no-op rolls per hit, legacy of an older
  slot scheme.
- **Suggested fix**: Delete the line (armor durability on :125 is the
  live one).

### CR-031 · P3 · S · Session 3 · Status: Open
- **Where**: src/systems/cards/logic/CombatProcessor.js:70/81/94-101
- **What**: `heroStatsForUi` is built every combat tick and never read —
  dead per-tick allocation in a hot path.
- **Suggested fix**: Delete it (UI gets combat progress via
  `area:progress` and the combat events).
- **Related**: CR-023 (tick-path allocation family).

### CR-032 · P3 · S · Session 3 · Status: Open
- **Where**: src/systems/hero/SkillSystem.js:137/141
- **What**: Unconditional `console.log` on every XP award and level-up —
  fires multiple times per second across 12 running areas; bypasses the
  logger's level control.
- **Suggested fix**: `logger.debug`, or delete.

### CR-033 · P2 · S · Session 3 · Status: Open — **owner decision needed**
- **Where**: src/systems/combat/WoundedSystem.js:55-67 (Date.now-based)
- **What**: Wounded recovery counts wall-clock time, not game time: the 5
  minutes tick down in real time regardless of time-scale. Under Time Bank
  fast-forward the world runs at 10x but injuries still heal at 1x —
  inconsistent with Phase 8's "the live engine just runs faster" model.
  (Upside of the current form: recovery also elapses offline, which the
  quest board does deliberately.)
- **Why it matters**: Spending banked time with an injured hero wastes
  bank — the player fast-forwards but the hero stays benched.
- **Suggested fix**: Owner call: wall-clock (then document it as
  intentional, like the quest board) or switch to delta-accumulated
  game-time (consistent with fast-forward). Session 7 can demo both.
- **Related**: CR-002, CR-022 (time-scale consistency family).

### CR-034 · P3 · S · Session 3 · Status: Open
- **Where**: src/systems/effects/StatusEffectSystem.js:101/111,
  src/systems/hero/logic/HeroLookup.js:30-32
- **What**: Two polish items: (a) the 5s status tick publishes
  `heroes_updated` for every statused hero even when nothing decayed or
  damaged; (b) benched heroes are excluded from getAllHeroes, so any
  statuses they carry are frozen indefinitely rather than ticking or
  clearing (rare — unassign cleanses — but reachable via CR-026's hole).
- **Suggested fix**: Publish only when the tick changed something; decide
  bench-status semantics when fixing CR-026.

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
