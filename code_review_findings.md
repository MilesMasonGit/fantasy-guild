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
| 4 | Cards, collection, economy & quests | ✅ Done (2026-07-17) | CR-018 verdict delivered; 9 tickets (CR-035–CR-043); 2×P1 (mastery crash imports, bank-slots no-op upgrade), 6×P2, 1×P3. |
| 5 | UI ↔ engine boundary | ✅ Done (2026-07-17) | Leak audit CLEAN (all 35 subscription sites paired). Mutation sweep clean. 4 tickets (CR-044–CR-047); 2×P2 architectural, 2×P3. CR-039 confidence resolved. |
| 6 | UI components | ✅ Done (2026-07-17) | CR-001 split verdict delivered (M, 5 files); CR-019/CR-041 resolved; 2 tickets (CR-048, CR-049) incl. 27 dead UI files by import-graph analysis. New banner/drawer/dnd code is high quality. |
| 7 | Runtime verification (hands-on) | ✅ Done (2026-07-17) | Tick budget PASS (0.09ms avg vs 5ms). CR-022 measured: −13.4% at 10x. Save roundtrip PASS. No leak signal (12-min window). 1 new ticket (CR-050 toast drift). Zero console errors. |
| 8 | Build, Tauri readiness & synthesis | ✅ Done (2026-07-17) | Build passes (1.09MB JS / 319KB gz). CR-003 resolved. 4 tickets (CR-051–CR-054): shipping CSS syntax bug, dep hygiene, core-engine test gap, Tauri persistence plan. Final prioritized backlog written. **REVIEW COMPLETE — 53 tickets.** |
| F1 | Fix Wave 1 | ✅ Done (2026-07-17) | 9 tickets fixed (CR-002/004/006/021/022/026/033/035/051) across a50a735, ea64e01, 24e05cc. Tests 81/81. Runtime-verified: 10x throughput 0.866→0.967; wounded drains 10.4× at 10x. |

**Next ticket ID:** CR-055

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

### Session 4 — Cards, collection, economy & quests *(reviewed 2026-07-17)*

**Collection / packs** (`CollectionManager`) — post-rework native, clean.
Owns `collection.playsets` (ownership source of truth), `globalPacksBought`.
Unified pack pool = unlocked areas' deckLists below playset cap ✓.
Publishes `collection_updated`. Gap: pack options not persisted (CR-040).

**Quests v2** (`QuestTracker` + `QuestBoardSystem`) — post-rework native,
clean. Owns `questBoard` (procedural boards per locked area) and
`areaStates[*].unlockQuestProgress/completedQuestIds` (MSQs). Subscribes
via processEvent fan-in (called from InventoryManager, combat victory,
hero assignment). Publishes `quest_board_updated`, `quest_completed`,
`quest_state_changed`. Wall-clock refresh timer (CR-033 family, known).
Side effect: ensureAreaState for locked areas grants their starter decks
early (CR-041).

**Economy** (`CurrencyManager`, `TransactionProcessor`, `CommerceSystem`,
`InventoryGroupManager`) — sound. All rewards route through
TransactionProcessor.apply ✓. CurrencyManager publishes `currency_changed`
(+ legacy `influence_changed` duplicate). Gold flows: packs, quest
rewards, guild upgrades, instant refresh, merchant sales.

**Inventory** (`InventoryManager` / `InventoryStore` / `InventoryFormatter`
/ `ItemRateTracker`) — Store normalizes legacy shapes on load ✓; stack
caps enforced (maxStack + maxStackBonus) ✓; slot capacity NOT enforced —
`maxSlots` has zero readers (CR-039). Publishes `inventory_updated` with
added/removed payloads consumed by notifications ✓.

**Guild upgrades** (`GuildUpgradeManager`) — the live progression system.
Recompute-from-ranks pattern (never increments) ✓ good design. Owns
`progress.guildUpgrades`, writes inventory.maxTabs/maxSlots/maxStackBonus,
progress.rosterLimit, collection.binder.maxTabs. bank_slots rank is
currently a no-op purchase (CR-039).

**Mastery** (`MasterySystem`) — orphaned + latently broken: unlock
evaluators have zero callers (CR-036) and the bonus path has two missing
imports that crash when reached (CR-035). StatProcessor/LootSystem query
it every completion — currently always returns zeros.

**Projects** (`ProjectManager`) — orphaned: project cards can't exist
under the deck loop; rewards write dead fields; notifications go to a
subscriber-less event (CR-038). Superseded by GuildUpgradeManager.

**Progression leftovers** (`ProgressionSystem`) — `unlockArea` is live
(QuestBoard unlock path ✓); map fragments + exploration functions have
zero callers (CR-037).

**Equipment** (`EquipmentManager` / `DurabilitySystem` / validator) —
shared-reference model (items stay banked, heroes link) ✓; vault-check
disables modifiers when stock runs out ✓. Five registered effect types
are never queried (CR-042); phantom aux slots (CR-030 addendum);
food/drink paths are CR-029 (owner-confirmed retired).

**Card assembler** (`CardAssembler`/`ModularSyncer`/`SlotMapper`/
`TraitRegistry`) — live via CardFactory.createInstance (ephemeral cards
get traits/slots from it). evaluateStationRecipe's dynamic-input matching
is legacy-shaped but harmless. RecruitSystem — clean drawer flow ✓.

**Registries** — mostly pure data (size-exempt). Dead weight: CR-043.

### Session 5 — UI ↔ engine boundary *(reviewed 2026-07-17)*

**Hooks layer** (`src/ui/hooks/`)
- `useEngine` — context access for mutations only (documented) ✓.
- `useGameState(selector, events, filter, options)` — THE read hook.
  Microtask-coalesced updates ✓, subscription pairing ✓, prop-driven
  resync via options.deps ✓. Clone modes: default shallow / `shallow` /
  `deepClone` / `bypassClone`. **Architectural caveat: default mode can't
  see in-place mutations (CR-044)** — correctness depends on selectors
  flattening to primitives or capturing `_rev` at top level.
- `useGameTick` — direct-callback hook for high-frequency visuals; its
  default event `cards_progress_updated` is never published (CR-045).
- `useGameEvent`, `useDiscovery`, `useDndTarget`, `useUIModals` — all
  subscription-safe ✓. useDiscovery's card branch reads deleted
  `state.library.tasks` (CR-047b).

**Leak audit — CLEAN.** All 35 EventBus.subscribe sites across 15 UI
files verified: every one unsubscribes on unmount (hook cleanups, mapped
unsub arrays, or explicit unsubscribe calls in ToastContainer). No
detached-listener leak risk from the UI layer. Long-session memory risk
shifts to Session 7's heap verification of engine-side subscribers.

**Mutation-from-UI sweep — clean with two nits.** No gameplay UI writes
GameState directly; mutations route through engine managers ✓. Nits:
TestDashboard (dev tool) writes retired state fields, and preview/ghost
card rendering bumps the persisted `cards.idCounter` (CR-047a/c).

**Hot-path visuals (objective 3 UI half)**
- `RefProgressBar` — the pattern done right: one `area:progress`
  subscription, areaId filter, style.width write, zero re-renders ✓.
- AreaBannerRow's HeaderTaskProgress/HeaderEnemyProgress use
  setState-per-progress-event (throttled to every 3rd tick, per-area
  filtered — acceptable; they re-render a small subtree).
- Legacy `base/ProgressBar.jsx` — prop-driven rendering works; its
  entire engine-driven direct-DOM branch is dead (CR-045).
- `useCombatantPanelTicks` force-renders on 5 unfiltered global events
  (CR-046).

**Event-contract notes for Session 6**: UI subscribes heavily to
`heroes_updated` (unfiltered, high frequency) — per-component selector
audit belongs to Session 6/7. `ui:*` command events (open_drawer,
notify, open_pack_overlay, …) flow UI→UI via the bus — coherent.

### Session 6 — UI components *(reviewed 2026-07-17)*

**Live component tree** (from ReactRoot): AreaBannerContainer → one
AreaBannerRow/CollapsedRow per unlocked area + QuestControlBar +
LockedAreaRow (quest boards); BottomFolderDrawer (CardsTab/BankTab +
TabStrip + InspectionPanel), HeroSideDrawer (HeroInspection,
RecruitmentSection); BubbleMenu; fullscreen GuildHall/PackShop/
AreaManager; modals Settings/SlotSelection/CollectionBinder/Bonus +
PackOpeningOverlay + AreaUnlockOverlay; ParticleOverlay, ToastContainer,
TimeBankWidget; dev: TestDashboard, FPSCounter, LayoutSandbox.

**AreaBannerRow (CR-001)** — split verdict recorded on the ticket. Uses
the model selector pattern (useAreaSnapshot). Subscribes per-area to all
8 structural `area:*` events + `area:progress` for bars; combat panels
force-render via 5 unfiltered global events (CR-046).

**Drawer layer** — CardsTab is exemplary (its deepClone comment documents
the CR-044 footgun from experience: "Phase 7 lesson"). Catalog =
unlocked-area deckLists ∪ owned playsets (this is where CR-041's leak
becomes visible). BankTab displays the unenforced maxSlots gauge
(CR-039). HeroInspection compensates for CR-026 manually.

**DnD layer (DndKit.jsx)** — well-designed: decentralized accepts/onDrop
per target, pointer-tracked ghost, surface-aware bloom, spring-back.
All drop handlers route through engine managers ✓ (DeckSlotManager,
StationSlotManager, HeroAssignmentManager, EquipmentManager). The OLD
useDndTarget hook + its 4 card-module consumers are dead-wired (CR-048).

**Selector audit (CR-044 follow-up)** — heavy components are safe
(flattened snapshots or deliberate deepClone). One suspected stale case:
HeroFocusRow selects the raw hero object with default shallow mode — its
Stats card vitals likely freeze while the focus is open (nested hp/energy
mutations invisible; no _rev bump on modifyHeroHp). Listed in CR-044 as
the Session 7 demo candidate.

**Dead components** — resolved by import-graph reachability (script, BFS
from src/main.jsx): 27 unreachable UI files + 9 unreachable non-UI files
(CR-049). Caveat: the analysis counts commented-out imports as live, so
the list is a floor.

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
- **Session 6 verdict (2026-07-17, full read)**: Split justified — the file
  holds five genuinely distinct responsibilities, already delimited by its
  own section comments: (1) row shell + shared row-card primitives
  (~350 ln), (2) the three focus views — deck editing / hero equip / recipe
  picker (~380 ln), (3) header + progress bars (~110 ln), (4) pillar cells
  + combat info panels (~350 ln), (5) adventure/station center cells
  (~330 ln). The seams are clean (components communicate via props, no
  shared module state), so this is a mechanical 5-file split — effort is
  **M, not L**. Internal quality is high: `useAreaSnapshot` is the model
  CR-044-safe selector (flattened primitives + per-area event filter).

### CR-002 · P1 · M · Session 3 · Status: Fixed (2026-07-17, ea64e01 —
hero + enemy attack accumulators subtract the interval instead of
resetting, the same pattern as the measured CR-022 fix; the 2s
intermission clamp is left as-is (≤1 tick loss per fight). No combat
card was reachable for a direct runtime measurement)
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
- **Session 8 resolution**: core/modifiers/utilities are live (DndKit.jsx).
  `@dnd-kit/sortable`'s only importer is vault/InvGroup.jsx — which is
  unreachable (CR-049). Remove the package with that sweep. Also fold in
  CR-048's dead useDndTarget. Fix lands with CR-049.

### Session 1 findings

### CR-004 · P1 · S · Session 1 · Status: Fixed (2026-07-17, a50a735)
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

### CR-006 · P2 · S · Session 1 · Status: Fixed (2026-07-17, a50a735 —
totalPlaytime counts game time, so it advances at the multiplier under
fast-forward; flag if wall-clock playtime is wanted instead)
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
- **Quantified (Session 7)**: 30 of the 118 boot-gated images (25%) are
  playmat art; manifest totals 396 files. Gate completed in 345ms on a
  warm dev machine — the waste is real but not currently painful.
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
- **Session 4 verdict (2026-07-17)** — per module:
  - **Dead, delete**: LookupProcessor (all getters return empty/null),
    LifecycleProcessor, TransformationProcessor (ambush morphing was
    dropped by locked decision), ProjectProcessor (blueprints are
    playmat-era), AssignmentSystem + HeroAssignmentHelper +
    NonHeroAssignmentHelper (every function early-returns CARD_NOT_FOUND;
    its `heroes_updated` subscriber no-ops on every event),
    AuraManager/EffectEngine/EffectProcessor (CR-027).
  - **Mostly dead**: CardManagerUtils — `bumpCardRev` and `cloneTraits`
    are live (combat mutates ephemeral cards); everything else no-ops.
    CardManager dispatcher shrinks to those + generateId.
  - **Orphaned systems** (bigger than dead code — see own tickets):
    ProjectManager (CR-038), MasterySystem evaluators (CR-036).
  - **UI consumers** (DropTableModal, RecipeSelectorModule,
    ActivityBadgeModule, BlueprintSlotModule, ProgressBar fallback,
    BadgeGutter): deferred to Sessions 5/6 via CR-019.
  - Combat's works-by-accident call sites are CR-028.

### CR-019 · P2 · S · Session 5/6 (stub, filed by Session 1) · Status: Open
- **Where**: src/ui/components/base/ProgressBar.jsx:151 (cards.active
  fallback), src/ui/components/base/GICard.jsx:59/93 (audio focus events),
  src/ui/components/hud/ChaosTracker.jsx + src/ui/modals/BonusModal.jsx
  (`area_switched` re-render hints), CardHeaderModule.jsx:19 +
  ThreatModule.jsx:14 (frozen activeAreaId reads)
- **What**: UI-side consumers of the dead state/events found in CR-005/
  CR-007/CR-010 — assess live vs. legacy in the UI sessions.
- **Related**: CR-005, CR-007, CR-010, CR-018.
- **Session 6 verdict (2026-07-17, import-graph analysis)**:
  - **Dead (unreachable)**: ChaosTracker, HeroGroup, CombatDisplay (+
    CombatLog/CombatStage), both DropTableModal implementations,
    GradualProgressComponent, CardExpansionManager — all in CR-049's
    deletion list.
  - **Live**: BonusModal (ReactRoot renders it; its `area_switched` hint
    is inert per CR-005 — harmless), GICard (hover audio events fire —
    CR-010(3) is live wiring after all), ProgressBar (see CR-045),
    CardHeaderModule/ThreatModule/BlueprintSlotModule/RecipeSelectorModule/
    ActivityBadgeModule (reachable via ModuleRegistry; render only for
    card types the deck loop can't produce — dormant with the §J systems).
  - **Technically live, practically dead**: HeroIdentityStrip — only
    mounted via CardSlot with idPrefix='slot'; its uncompensated
    right-click bench path (CR-026) requires idPrefix='roster' +
    isTavernOpen and is unreachable. CR-026's engine-side fix stands on
    defense-in-depth grounds.

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

### CR-021 · P2 · S · Session 2 · Status: Fixed (2026-07-17, 24e05cc)
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

### CR-022 · P2 · S · Session 2 · Status: Fixed (2026-07-17, ea64e01 —
re-measured on a hazard-free all-task deck with the energy confound
removed: throughput ratio at 10x improved 0.866 → 0.967, statistically
consistent with 1.0 given the 1x baseline's ±7% sample noise; station
craft cycles carry their remainder too)
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
- **MEASURED (Session 7, 2026-07-17)**: with 4 areas running task loops,
  1x baseline = 10.51 completions/game-minute (n=41 over 234s); at 10x =
  9.10 completions/game-minute (n=267 over 1,760 game-seconds). **Ratio
  0.866 — a 13.4% loss of banked-time value.** The clock itself is exact
  (effective multiplier measured 10.00), so the loss is entirely the
  discarded phase-transition overshoot. Confirmed, no longer suspected.
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

### CR-026 · P2 · S · Session 3 · Status: Fixed (2026-07-17, 24e05cc)
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
- **Suggested fix**: ~~Owner call~~ **Owner decision (2026-07-17): hero-
  carried food/drink is no longer a feature.** Fix direction settled:
  remove the food/drink slots, ConsumableSystem + its 1s tick, both
  auto-eat paths (idle + combat), the drawer's food/drink gear buttons,
  GEAR_LOSS_EXEMPT_SLOTS, and lastEatenAt/lastDrunkAt.

### CR-030 · P3 · S · Session 3 · Status: Open
- **Where**: src/systems/cards/logic/CombatAttackProcessor.js:126
- **What**: Every enemy hit rolls 25% durability damage against 'head',
  'body', 'hands', 'feet' — slots that don't exist (EQUIPMENT_SLOTS is
  weapon/armor/food/drink). Four no-op rolls per hit, legacy of an older
  slot scheme.
- **Suggested fix**: Delete the line (armor durability on :125 is the
  live one).
- **Session 4 addendum**: same phantom slots in
  src/systems/equipment/DurabilitySystem.js:44-48 ("auxiliary armor slot
  wear" rolls a random head/body/hands/feet item that can never exist,
  with a fractional 0.5 decrement to boot). Delete that block too.

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

### CR-033 · P2 · S · Session 3 · Status: Fixed (2026-07-17, ea64e01 —
verified live: recovery drains 1:1 at 1x and 10.4× real-time at 10x;
legacy woundedUntil saves convert in place on first tick)
- **Where**: src/systems/combat/WoundedSystem.js:55-67 (Date.now-based)
- **What**: Wounded recovery counts wall-clock time, not game time: the 5
  minutes tick down in real time regardless of time-scale. Under Time Bank
  fast-forward the world runs at 10x but injuries still heal at 1x —
  inconsistent with Phase 8's "the live engine just runs faster" model.
  (Upside of the current form: recovery also elapses offline, which the
  quest board does deliberately.)
- **Why it matters**: Spending banked time with an injured hero wastes
  bank — the player fast-forwards but the hero stays benched.
- **Suggested fix**: ~~Owner call~~ **Owner decision (2026-07-17): ALL
  features must speed up under banked time** (the Time Bank is the
  fallback offline system, so it has to be faithful). Switch WoundedSystem
  to delta-accumulated game-time. Audit for other wall-clock users while
  fixing — QuestBoardSystem's timestamp refresh is the known other one
  (its offline-counting behavior is desirable; reconcile with the
  all-features-scale rule when fixing).
- **Related**: CR-002, CR-022 (time-scale consistency family — the same
  owner decision confirms both should be fixed for precision, not left as
  accepted approximation).

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

### CR-035 · P1 · S · Session 4 · Status: Fixed (2026-07-17, a50a735)
- **Where**: src/systems/progression/MasterySystem.js:120/177
  (`getCardTemplate` — never imported), :226 (`SUB_SKILL_TO_PARENT` —
  never imported)
- **What**: Two identifiers are used but not imported — a guaranteed
  ReferenceError the moment (a) any project reaches level > 0, or (b) a
  mastery bonus with a `filter.skill` is evaluated for a task with a
  subskill. `getEffectiveBonuses` is called on **every task completion
  and every loot roll** (StatProcessor + LootSystem); the LootSystem path
  has no try/catch, so the crash reaches the area's tick.
- **Why it matters**: Currently masked only because masteries can never
  unlock (CR-036) and projects can never level (CR-038) — the moment
  either system is re-wired, every task in the game starts erroring.
  A landmine directly under two open tickets' fixes.
- **Suggested fix**: Add the two imports (or delete the project branch
  with CR-038). One-line fix; do it first.

### CR-036 · P2 · M · Session 4 · Status: Open
- **Where**: src/systems/progression/MasterySystem.js:22/61 (evaluators —
  zero callers), areaState.mastery / collectionProgress (never written)
- **What**: The mastery unlock system is orphaned: `evaluateSetMastery`
  and `evaluateQuestMastery` are called by nothing (their callers died
  with the Library), and `areaState.collectionProgress` is never updated,
  so `setMasteryUnlocked`/`questMasteryUnlocked` stay false forever. The
  area sets' authored `masteryBonuses` are unreachable content.
- **Why it matters**: A whole progression carrot (mastery bonuses per
  area) silently doesn't exist, though the query side runs on every
  completion pretending it might.
- **Suggested fix**: Owner decision — re-wire under the deck loop (e.g.
  evaluate set mastery from `playsets` in claimToCollection, quest
  mastery from quest completion) or explicitly defer/remove. Fix CR-035
  first either way.

### CR-037 · P2 · S · Session 4 · Status: Open
- **Where**: src/systems/progression/ProgressionSystem.js:17/68/100
  (zero callers), state.mapFragments (schema + REQUIRED_KEYS),
  areaState.explorationCount
- **What**: Map fragments and the exploration cost/counter are retired
  (Quest System v2 comment in QuestTracker confirms fragments are gone)
  but the functions, schema field, and save-validator requirement remain.
- **Suggested fix**: Delete the three functions, drop `mapFragments` from
  the schema and REQUIRED_KEYS (save-compat: keep loading saves that
  have it), decide explorationCount's fate with CR-036.

### CR-038 · P2 · M · Session 4 · Status: Open
- **Where**: src/systems/project/ProjectManager.js (all of it);
  reward writes at :196 (`inventory.maxSlots +=`) and :207
  (`inventory.maxStackSize` — field exists nowhere else); `notification`
  event published at :121/:182/:197/:208 with **zero subscribers**
- **What**: The Projects system is triply broken: (a) orphaned — project
  cards aren't deck-slottable, so its trigger event can never fire; (b)
  its slot/stack rewards write to dead or clobbered fields
  (GuildUpgradeManager.recompute overwrites maxSlots from ranks on every
  load); (c) its four player notifications go to an event nobody
  subscribes to. GuildUpgradeManager is the live, owner-approved
  replacement for this progression axis.
- **Suggested fix**: Owner decision: retire Projects (delete manager +
  schema fields progress.projects/chainProgress/completedProjects +
  projectRegistry per CR-043) or spec a deck-loop re-integration. Don't
  leave the broken reward code either way.
- **Related**: CR-035, CR-043, GuildUpgradeManager system-map entry.

### CR-039 · P1 · M · Session 4 · Status: Open
- **Where**: src/systems/progression/GuildUpgradeManager.js:80 (writes
  inventory.maxSlots), src/systems/inventory/InventoryManager.js (addItem
  — no slot-capacity check), zero readers of maxSlots found in src/
- **What**: The `bank_slots` Guild Hall upgrade increases
  `inventory.maxSlots` — a value nothing reads. There is no slot-capacity
  enforcement anywhere in the inventory engine (only per-item stack
  caps), so the upgrade the player buys with gold does nothing.
- **Why it matters**: Players spend real progression currency on a no-op.
  Either slots are a real constraint (then addItem must enforce and the
  upgrade matters) or slots aren't a mechanic (then the upgrade is
  selling nothing and should be removed).
- **Suggested fix**: Owner decision on whether bank slot capacity is a
  real mechanic; implement enforcement or remove the upgrade node.
- **Confidence**: ~~Session 5/6 to confirm UI reads~~ **Resolved (Session
  5)**: BankTab.jsx:64/248/251 *displays* `stocked/maxSlots` and styles it
  red at the cap — but the engine never enforces it, so the bank can show
  "25/20" in red while items keep flowing in. The upgrade buys a bigger
  number on a gauge that constrains nothing. Verdict stands: decide the
  mechanic, then enforce in addItem or remove gauge + upgrade node.
- **Related**: CR-011 (the schema's third, also-dead capacity shape
  `inventory.slots{max,used}`).

### CR-040 · P2 · S · Session 4 · Status: Open
- **Where**: src/systems/progression/CollectionManager.js:80-99
  (buyUnifiedPack), pack options handed to UI without persistence
- **What**: Buying a pack spends gold and generates 4 options in memory;
  if the game closes/crashes/reloads before the player claims one, the
  gold is gone and the pack never existed. The recruitment system
  persists its candidates for exactly this reason (schema comment).
- **Suggested fix**: Persist pending options (e.g.
  `collection.pendingPackOptions`) and have the pack overlay re-open
  from state on load, mirroring recruitment.candidates.

### CR-041 · P2 · S · Session 4 · Status: Open
- **Where**: src/systems/progression/QuestTracker.js:43
  (ensureAreaState for locked areas), src/systems/area/
  AreaStateManager.js:53-72 (grantDefaultDeckOwnership)
- **What**: Advancing unlock-quest progress materializes the full
  areaState for every locked area — including building its authored
  default deck and granting those cards into `collection.playsets`. Net
  effect: the player owns (and can slot elsewhere, where tags allow)
  cards from areas they haven't unlocked, from the first loot drop of a
  session onward.
- **Why it matters**: Undermines the unlock reveal (Binder shows
  locked-area cards early) and slightly cheats the deck-building economy.
- **Suggested fix**: Track unlockQuestProgress in a lightweight structure
  (or flag ensureAreaState to skip the ownership grant until the area is
  actually unlocked).
- **Confidence**: ~~Session 6 confirm~~ **Confirmed player-visible
  (Session 6)**: binderCatalog.buildCardCatalog:49 includes "anything
  already owned regardless of source" — the leaked locked-area cards
  appear in the Cards drawer and Binder, fully deployable. Impact is
  real, not theoretical.

### CR-042 · P2 · S · Session 4 · Status: Open
- **Where**: src/systems/equipment/EquipmentManager.js:133 (HPBONUS /
  TICKSPEEDBONUS via stat.toUpperCase()), :198-251 (SLOW_ENEMY, SUNDER,
  EVASION, LIGHT, HASTE)
- **What**: Seven modifier types are registered onto hero aggregators
  from gear but **queried nowhere** — items carrying those effects do
  nothing. Live types are DAMAGE, DEFENSE, ACCURACY, RESIST_FLAT (and
  SKILL_LEVEL — verify at fix time). The EFFECT_TYPES constants file
  doesn't even list most of the strings in use.
- **Why it matters**: Gear silently weaker than its data claims; item
  authoring against effect names that don't exist yet has no guardrail.
- **Suggested fix**: When the gear pass lands, wire or delete each type;
  meanwhile consolidate all live modifier-type strings into
  effects/constants.js so dead ones are visible.
- **Related**: CombatFormulas' documented crit/armor hooks (those are
  intentional; these aren't documented anywhere).

### CR-043 · P3 · S · Session 4 · Status: Open
- **Where**: src/config/registries/projectRegistry.js (380 lines, zero
  importers), CodexRegistry.js (102 lines, zero importers);
  tileRegistry.js (consumers: dead AuraManager + BadgeGutter — S6),
  invasionRegistry/threatRegistry (only via ThreatModule — CR-019),
  dungeonRegistry/eventRegistry (only via cardRegistry template assembly
  — §J dormant); duplicate DropTableModal implementations
  (src/ui/components/DropTableModal.js AND src/ui/modals/
  DropTableModal.jsx — Session 6 to pick the live one)
- **What**: Registry dead weight headed for the Tauri bundle.
- **Suggested fix**: Delete the zero-importer files now; the rest follow
  their owning tickets (§J systems keep their data until deliberately
  revisited).
- **Related**: CR-003 (Session 8 bundle audit), CR-019.

### Session 5 findings

### CR-044 · P2 · M · Session 5 · Status: Open
- **Where**: src/ui/hooks/useGameState.js:32-55 (clone modes), 79
  (isEqual gate)
- **What**: The default clone mode (shallow) plus deep-equality gating
  cannot detect the engine's primary mutation style (in-place writes).
  The shallow clone shares nested object references with live state, so
  fast-deep-equal short-circuits on identical references and reports "no
  change" for any nested mutation — a selector returning live
  objects/arrays only re-renders when a top-level primitive captured at
  clone time (e.g. `_rev`) differs, or a reference was wholesale
  replaced.
- **Why it matters**: Correctness is convention-dependent per callsite:
  components must either select flattened primitives, pass `deepClone`,
  or rely on `_rev` bumps at the right level. Nothing enforces this —
  each new component is one selector away from silently-stale UI. This
  is likely the root cause of the scattered `_rev`/bumpCardRev
  machinery.
- **Suggested fix**: Pick one contract and document it in the hook:
  (a) selectors must return primitives/flattened projections (lint-able
  convention), or (b) default to deepClone for small slices, or (c)
  engine adopts consistent top-level rev-bumping. Session 6 should audit
  existing selectors against whichever contract; Session 7 can
  demonstrate a live stale case.

### CR-045 · P2 · M · Session 5 · Status: Open
- **Where**: src/ui/components/base/ProgressBar.jsx:136-225 (engine
  branch), src/ui/hooks/useGameTick.js:13 (default event);
  StatBarsModule.jsx:31/50 (dead heroId/targetType props)
- **What**: The event that drives ProgressBar's direct-DOM update branch
  (`cards_progress_updated`) is published by nothing — the ~100-line
  engine-driven path (including its getCardById/cards.active lookups)
  never executes. Every live bar renders via props (parent re-renders)
  or via the new RefProgressBar. Vitals bars work only because parents
  re-render on `heroes_updated`.
- **Why it matters**: Half of the most-reused visual component is dead
  scaffolding claiming perf properties it doesn't deliver; targetType/
  heroId props scattered through hero UI do nothing.
- **Suggested fix**: Strip ProgressBar to its prop-driven half (or
  re-point the fast path at `area:progress`/`heroes_updated` payloads if
  measured re-render cost justifies it — Session 7's call); drop the
  dead props at callsites; change useGameTick's default event or delete
  the hook if unused after cleanup.
- **Related**: CR-007/CR-018 (dead lookups), CR-019.

### CR-046 · P3 · S · Session 5 · Status: Open
- **Where**: src/ui/components/banner/AreaBannerRow.jsx:954-963
- **What**: `useCombatantPanelTicks` force-renders its combat panels on
  five unfiltered global events — including `heroes_updated`, which
  fires at least once per second from regen alone (plus XP awards and
  the 5s status tick for every statused hero, areas unrelated to the
  panel included).
- **Why it matters**: Render-storm risk while a combat panel is open;
  bounded but pure waste. Objective-3 hygiene.
- **Suggested fix**: Filter by the panel's cardId/areaId in the handler
  (the combat events carry cardId; heroes_updated carries heroId).

### CR-047 · P3 · S · Session 5 · Status: Open
- **Where**: (a) src/ui/dnd/DragGhost.jsx:53, src/ui/components/banner/
  AreaBannerRow.jsx:225, src/ui/components/drawer/CardsTab.jsx:242;
  (b) src/ui/hooks/useDiscovery.js:55; (c) src/ui/components/
  TestDashboard.jsx:52/91-110/139; (d) src/ui/components/
  AreaUnlockOverlay.jsx:25-26
- **What**: Boundary nits: (a) UI preview/ghost rendering calls
  CardFactory.createInstance, which increments the *persisted*
  `cards.idCounter` — a state write from the render path; (b)
  useDiscovery's card branch reads the deleted `state.library.tasks`
  (always false) instead of playsets; (c) the dev TestDashboard writes
  retired fields (threats.activeInvasions, mapFragments, chaosPoints) —
  stale dev tooling; (d) AreaUnlockOverlay's stage setTimeouts aren't
  cleared on unmount.
- **Suggested fix**: Non-mutating preview factory (skip generateId);
  route card discovery through CollectionManager.isCardDiscovered;
  prune/refresh TestDashboard; clear the timeouts.

### Session 6 findings

### CR-048 · P2 · S · Session 6 · Status: Open
- **Where**: src/ui/hooks/useDndTarget.js:65/90-91 (listens for
  `dnd:drag-start`/`dnd:drag-end` and the `is-dragging` body class);
  consumers: BlueprintSlotModule.jsx:22, ToolSlotModule.jsx:27,
  InputSlotModule/InputSlotItem.jsx:54, base/CardSlot.jsx:30;
  src/tailwind.css:373-389 (`is-dragging-*` rules)
- **What**: The old drag system's targeting hook is dead-wired — nothing
  publishes those events or sets that class (the new DndKit sets
  `gi-dnd-active` and uses its own useEntityDrop cues). The four
  card-module consumers never show drag-target feedback, and the CSS
  rules never apply.
- **Why it matters**: This is the known "DnD rework Step 4 cleanup" that
  was deferred — now with a precise inventory. Any module still relying
  on it silently lost its drop affordances.
- **Suggested fix**: Delete useDndTarget + the is-dragging CSS; migrate
  any of the four consumers that still render (ToolSlot/InputSlot on live
  card faces) to useEntityDrop, or delete them with CR-018's sweep.
- **Related**: CR-018, CR-019; DnD rework Step 4 (dnd_rework tracker).

### CR-049 · P2 · M · Session 6 · Status: Open
- **Where**: 36 files, verified unreachable by import-graph BFS from
  src/main.jsx (2026-07-17). UI (27): CardExpansionManager,
  DropTableModal (BOTH copies: components/DropTableModal.js +
  modals/DropTableModal.jsx), GradualProgressComponent, PalettePreview,
  base/{Accordion, CameraControls, ContextMenu, EnvironmentLayer,
  GIDraggable, GITitleModule, SortableCard, Tabs},
  card-modules/AreaDeckBadge, combat/{CombatDisplay, CombatLog,
  CombatStage}, hero/{ActivityModule, HeroGroup, InformationModule},
  hud/ChaosTracker, library/LibraryPip, vault/{InvGroup,
  ItemQuantityBadge, ItemSellControls}, modals/library/LibraryFilters,
  hooks/{useGameEvent, useRenderTrace}. Non-UI (9):
  config/cards/JsonCardLoader, config/featureFlags.js (the flag file the
  Phase 9 sweep missed), config/uiConstants,
  registries/{CodexRegistry, regionRegistry},
  systems/cards/ModuleHelpers, systems/equipment/DurabilityManager,
  utils/{GridLookup, IconUtils}.
- **What**: ~3,400 lines of unreachable code headed for the Tauri bundle.
- **Why it matters**: Bundle weight (Session 8) and reader confusion —
  several are convincing look-alikes of live components (CombatDisplay
  vs the live combat panels; two DropTableModals).
- **Suggested fix**: Delete in one sweep; re-run the reachability script
  after (commented-out imports made the analysis conservative — a second
  pass may free more, e.g. projectRegistry per CR-043).
- **Related**: CR-003/CR-043 (Session 8 bundle audit), CR-019.

### Session 7 findings

**Method**: dev server, fresh save in slot 0, all 4 authored areas
unlocked with one hero each via engine console API (12 areas is the
design target but only 4 exist in content — engine costs below are
extrapolated ×3 where noted). All instrumentation was runtime-only
(in-memory wrappers); no game code touched.

**Measured results (confirms/refutes prior tickets)**
- **Tick budget (objective 3): PASS, huge headroom.** All 9 tick
  handlers together average **0.089ms per 100ms tick** (1.8% of the 5ms
  budget) with 4 areas active; loop_runner dominates at 0.064ms avg /
  3.2ms one-off max. Extrapolated to 12 areas: ~0.25ms avg. The engine
  is nowhere near its budget.
- **CR-022 CONFIRMED, quantified**: −13.4% banked-time value at 10x
  (see ticket addendum). Time accounting itself is exact.
- **CR-002 not exercised**: the authored default decks contain no combat
  cards, so no fights occurred during measurement; the combat pacing
  root cause stands on Session 3's code reading.
- **Save/load roundtrip (objective 4): PASS.** Fingerprint of heroes/
  skills/equipment/playsets/use-counts/inventory/deck state/bank/gold/
  game-clock before save vs after reload+load — every diff attributable
  to 1–2s of live play between snapshots; zero structural loss.
  Live save also confirms CR-006 (totalPlaytime 0, lastSavedAt null),
  CR-012 (aggregator husks + derived fields saved), CR-024
  (_dirtyStats/_activeDuration saved). Whole save: 12KB — bloat tickets
  correctly rated P3.
- **Memory: no leak signal** over a 12-minute window including the 10x
  burst — heap sawtoothed 35→65MB at 1x, spiked to ~175MB during 10x,
  and was reclaimed within a minute of stopping. A true multi-hour idle
  soak remains open (recommend before Steam; nothing observed suggests
  it will fail).
- **Event rates at 4 areas**: `area:progress` ~13/s (by design),
  `heroes_updated` ~0.7/s, everything else <1.5/s. No render-storm
  conditions observed outside combat (combat panels not exercised —
  CR-046 unmeasured).
- **Boot**: critical-art gate 345ms, 278 background images warm
  post-boot, zero console errors across the entire session.
- **CR-044 stale-vitals repro: inconclusive** — the hero focus view
  couldn't be driven programmatically this session (synthetic clicks
  didn't reach React's handlers). Mechanism remains code-verified;
  a manual 30-second check (open equip focus, watch HP during a fight)
  will settle it whenever the owner plays.

### CR-050 · P2 · S · Session 7 · Status: Open
- **Where**: src/ui/components/base/ToastContainer.jsx (local toast
  state) vs src/systems/core/NotificationSystem.js queue
- **What**: **Live repro** — after ~10 minutes of play the engine's
  notification queue held exactly its cap (10), but the DOM showed
  22–27 rendered toasts: ToastContainer's React state accumulates
  entries the engine no longer tracks. Persistent item toasts
  (itemDuration 0 by default) make the drift visible and permanent.
- **Why it matters**: Toast column grows unboundedly during long idle
  sessions — visual clutter and slow DOM growth on exactly the
  multi-hour sessions the game is built for.
- **Suggested fix**: Make ToastContainer reconcile against
  NotificationSystem.getQueue() on every change event (single source of
  truth) instead of add/remove bookkeeping; investigate the missed
  `notification_dismissed` path while there.
- **Confidence**: The drift is repro'd and certain; the exact lost-event
  mechanism is not yet isolated.
- **Related**: CR-017 (trim-loop staleness — engine side held the cap
  correctly in this test, so the bug is UI-side).

---

## FINAL SYNTHESIS — Prioritized Fix Backlog *(Session 8, 2026-07-17)*

**Review verdict in one paragraph**: The Deck Loop rework itself is
sound — engine architecture, performance (2% of tick budget), save
integrity (runtime-verified), the event system, and the new UI are all
solid, and no P0 (data-loss/crash-now) issues exist. Nearly all debt is
**pre-rework code the rework orphaned**: dead systems still wired up,
half-retired features, and contracts pointing at deleted counterparts.
The fix work is therefore mostly *deletion and small corrections*, not
redesign. 53 tickets: 0×P0, 5×P1-class, ~30×P2, rest P3 (1 won't-fix).

**Wave 1 — Quick correctness wins (one session, all S-effort)**
1. CR-035 mastery missing imports (do first — landmine under Wave 4)
2. CR-004 autosave interval ignored at boot
3. CR-022 + CR-002 remainder-carry fixes (measured −13.4% at 10x;
   owner-confirmed all features must scale) + CR-033 wounded recovery
   to game-time (same decision)
4. CR-051 shipping CSS syntax error
5. CR-006 playtime counter (visible on the very first screen)
6. CR-026 bench/retire area-unassign + CR-021 displaced-hero cleanse

**Wave 2 — Owner-decided removals (one session)**
7. CR-029 hero food/drink removal (decided 2026-07-17)
8. CR-005 active-area concept removal (decided 2026-07-17; BGM deferred)

**Wave 3 — Decisions needed from the owner, then small fixes**
9. CR-039 bank slot capacity: real mechanic or remove the upgrade?
10. CR-036 mastery: re-wire under deck loop, or defer/remove?
11. CR-038 projects: retire (GuildUpgradeManager replaced it) or spec
    re-integration? (CR-037 fragments/exploration ride along)

**Wave 4 — The great deletion (1–2 sessions, mechanical, high-volume)**
12. CR-049 dead files (36) + CR-018/CR-027/CR-007 dead card machinery +
    CR-043 dead registries + CR-048 dead DnD hook + CR-003/CR-052 dep &
    asset hygiene + CR-009 preloader regex. Re-run the reachability
    script after; expect several thousand lines gone and the Tauri
    bundle meaningfully lighter. CR-053's tests should land BEFORE this
    wave for regression safety.

**Wave 5 — P2 correctness & robustness**
13. CR-050 toast drift (live-repro'd), CR-040 pack persistence,
    CR-041 locked-area card leak, CR-028 combat status no-ops,
    CR-008 wire the save validator, CR-011 settings schema drift,
    CR-054 Tauri save durability (before any Steam build)

**Wave 6 — Architecture investments (each its own session)**
14. CR-044 useGameState contract (+ the HeroFocusRow stale-vitals
    check), CR-001 AreaBannerRow 5-file split, CR-045 ProgressBar strip

**P3 polish batch (opportunistic)**: CR-012/013/014/015/016/017/023/
024/025/030/031/032/034/042/046/047/052.

**Standing recommendations**: multi-hour idle soak before Steam
(Session 7 saw no leak signal in 12 min); manual 30-second stale-vitals
check next time the owner plays; keep the reachability script
(scratchpad `reachability.mjs` — worth committing to tools/) as a
regression check after each deletion wave.

---

### Session 8 findings

**Build audit (2026-07-17)**: `vite build` passes in 9.7s. Output:
1,086KB JS (319KB gzip, single chunk), 337KB CSS (50KB gzip), 16KB
asset manifest. Single-chunk is acceptable for a Tauri desktop target;
CR-049's sweep is the main size lever. Public assets: 8.7MB (audio 4.8 —
of which one 3.8MB BGM; backgrounds 2.7; playmat 0.7 = deletable per
CR-009/CR-049 family). Build warnings: the CSS syntax error (CR-051)
and mixed static/dynamic import notices (GameState.js's lazy
HeroManager/EquipmentManager imports defeat code-splitting anyway —
make them static during CR-007's cleanup).

### CR-051 · P2 · S · Session 8 · Status: Fixed (2026-07-17, a50a735)
- **Where**: src/styles/main.css:230
- **What**: A CSS comment documenting a *previous* CSS bug contains the
  literal `p-*/m-*` — the `*/` terminates the comment early, leaving
  `m-* utility app-wide … */` as invalid CSS immediately before the
  `@layer base` universal reset. esbuild flags it on every build; CSS
  error recovery may be discarding up to the entire base-reset block.
- **Why it matters**: Shipping malformed CSS whose blast radius depends
  on parser error recovery — exactly the class of silent breakage the
  comment itself warns about.
- **Suggested fix**: Reword the comment (e.g. "p-/m- utilities"). One
  line; verify the build warning disappears.

### CR-052 · P3 · S · Session 8 · Status: Open
- **Where**: package.json; public/assets/audio; AudioSystem._getMusicPath
- **What**: Dependency/asset hygiene: (a) `sharp` (native image lib) is
  a runtime dependency but only scripts/*.cjs use it — move to
  devDependencies; (b) @dnd-kit/sortable removable with CR-049 (see
  CR-003); (c) AudioSystem maps 3 BGM tracks but only 1 file exists
  (forest_theme.mp3 / mountain_theme.mp3 would 404 — currently
  unreachable via CR-005 anyway); (d) ~35 of 55 SFX files are unmapped
  (~0.6MB — minor).
- **Suggested fix**: Fold into the CR-049 sweep + CR-005's BGM decision.

### CR-053 · P2 · M · Session 8 · Status: Open
- **Where**: src/tests/ (14 files, 81 tests — all green)
- **What**: The test suite predates the rework's core: there are **zero
  tests** for LoopRunner, StationManager, DeckSlotManager,
  StationSlotManager, HeroAssignmentManager, SaveManager/serialize,
  TimeBankManager, GuildUpgradeManager, and QuestBoardSystem — the
  systems every earlier session found bugs in. The green suite mostly
  covers older subsystems (formulas, status effects, registries).
- **Why it matters**: The fix sessions are about to modify exactly these
  systems with no regression net. Cheap, high-leverage tests exist for
  each (pure-logic tick functions, serialize roundtrip, ownership
  reconcile).
- **Suggested fix**: Before or alongside the P1 fixes, add: loop
  phase-transition tests (incl. the CR-022 remainder-carry), a
  serialize/load roundtrip test, DeckSlotManager rule tests, and a
  TimeBank drain test. Roughly one session.

### CR-054 · P2 · M · Session 8 · Status: Open
- **Where**: SaveManager (localStorage-only), beforeunload save hook
- **What**: Desktop-readiness gap: saves live solely in the WebView's
  localStorage. Under Tauri that storage can be wiped by webview cache
  resets, isn't user-backupable, and the beforeunload flush is not
  reliable on native window close — combined with CR-004 (autosave
  interval bug) the player's only guarantee is the autosave timer.
- **Why it matters**: For Steam, save durability is table stakes; "my
  save vanished" is the review-killer for idle games.
- **Suggested fix**: Before the Tauri wrap: write saves through Tauri's
  fs API (real files in app-data, atomic write + previous-save backup),
  keep localStorage as dev/web fallback, add manual export/import. Also
  hook Tauri's close event for a final flush instead of beforeunload.
- **Related**: CR-004, CR-013 (key migration if storage moves).
