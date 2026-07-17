# Roadmap v3: Playmat → Area Deck Loop System Rework

This is the updated roadmap incorporating gap analysis findings, design decisions, and **performance optimization patterns** for scaling to 12 simultaneous areas.

> [!NOTE]
> **Design decisions locked in this revision:**
> - Hero assignment auto-swaps between areas (loop resets on any deck/hero/equipment change)
> - Cards live in a single unified collection (the active/library split is retired)
> - All unlocked areas run their loops simultaneously (true idle)
> - Energy system stays (tweaked to flat draw cost, pause if insufficient)
> - Status buffs and Area Skill Trees are deferred to a future pass
> - Existing sidebars stay functional until the Bottom Drawer replaces them
>
> **Performance architecture locked in this revision:**
> - Area-scoped events replace global broadcast events (prevents 12× cascade recalculations)
> - Flyweight card slots store only `templateId` + runtime state (no template data duplication)
> - Fast-path tick loop: countdown ticks are O(1) per area; heavy work only on card completion
> - Area-scoped dirty flags: stat recalculation targets only the affected area's cards
> - Event batch coalescing: multiple events per tick are deduplicated and flushed once
> - Ref-based progress bars bypass React state for high-frequency visual updates

---

## Implementation Status *(update this as work progresses)*

> [!TIP]
> **For future sessions:** check this table first. It's the fastest way to know what's already done without reading the whole roadmap. When you finish a phase, change its status here and note the date + branch/commit. If you start a phase but don't finish it in one session, mark it "In Progress" and leave yourself a one-line note about where you stopped.

| Phase | Status | Notes |
|---|---|---|
| Planning (gap analysis, this doc) | ✅ Done (2026-07-07) | See Appendix A-1 for the decisions log |
| 0 — Safety Infrastructure | ✅ Done (2026-07-07, `deck-loop-rework`) | §-1 abandoned diff discarded (owner-approved). Smoke test verified in browser: flag off = identical game; flag on = placeholder, no errors; old 1.0.0 saves refused with message. Extra fix found by smoke test: slot-select UI now stays on the slot screen when a load is refused instead of half-booting. |
| 1 — Feature Deprecation & Retirement Gating | ✅ Done (2026-07-07, `deck-loop-rework`) | Scope confirmed with owner: gating/muting only — the "adapt" bullets in §1B (hero lookup redirect, banner-slot drops, tool durability mute) land in Phases 2/3/5/6 when their targets exist. Gated: grid UI components, DeckCardView, ThreatSystem init+tick, InvasionManager init, spawn_area_event/spawn_invasion subscribers (CardManager + invasion notifications), CardResolver dispatch, card-targeted assignment. Smoke test verified in browser both flag states, incl. A/B against pre-change baseline. Pre-existing issues found (not Phase 1 regressions, flagged separately): NaN progress-bar width console errors; new game starts with 0 gold so pack purchase is silently blocked. |
| 2 — Core Data Schema & State Rework | ✅ Done (2026-07-07, `deck-loop-rework`) | Decisions confirmed with owner: `collection.playsets` is the ownership model (§2A's `ownedCards` dropped — §5B already assumed playsets); threat/chaos/invasion counters kept in the new areaState shape, `cardSnapshots` dropped flag-on. `unlockQuestIds` (plural) authored per area, CMS-derived from quest Map Fragment Targets; per-area progress in `areaStates[id].unlockQuestProgress` (roadmap's `activeQuestProgress` never existed in code — built new). Unlock quests auto-complete + auto-consume turn-in items (provisional; revisit at Phase 6 UI). Default decks authored for all 4 areas; sync API has a merge guard so stale CMS stores can't wipe `deckSlots`. Smoke test verified in browser both flag states + CMS authoring + merge guard. Data issues found for owner (not fixed, pre-existing): `quest_whispering_path` targets nonexistent `item_mpqi3mjl`; 4 quests reference deleted area `area_mpftfwt8`; `task_rocky_outcrop` duplicated ID across two areas' task files; Whispering Woods has no unlock quests (unreachable) and no cards; Sunken Bog has 4 unlock quests but only needs 3 fragments. |
| 3 — Backend Loop Engine | ✅ Done (2026-07-07, `deck-loop-rework`) | Owner-approved decisions: ephemeral card model bridges flyweight slots to the preserved WorkProcessor/CombatProcessor engines; energy draw cost is a global constant (`loopConstants.js`, 2/draw); ambush `combat_trigger`s dropped flag-on (possible future re-add); defeat penalties are placeholders (25% consumable stacks, 10% gear loss). §3I drift found+logged: roadmap cited the dormant `systems/combat/CombatTickProcessor` — hand-off drives the live `cards/logic/CombatProcessor` instead (dormant trio flagged for Phase 9). §3G's `recalculateAreaStats` lives in LoopRunner (no per-slot instances exist to walk). Smoke test verified in browser: 4 areas ticking independently (incl. one in combat while others run), draw/shuffle pacing, energy pause + auto-resume via regen, hazard damage (8 poison @ Sunken Bog), combat hand-off victory (XP+loot) and defeat → Forced Retreat (wounded hero, stationed/injured, penalties), loop-reset rule on equipment change, save/load mid-loop (incl. mid-combat rematerialization), event batching (1 `inventory_updated`/tick), perf avg 0.03ms max 1.1ms per tick vs 5ms budget. Flag-off regression: old grid boots, old tick handlers registered, 1.0.0 saves still refused, ambushes still work; 76/76 tests pass. Note: no consumable card templates exist yet (Phase 5 authors them) — §3E consumable/skip logic is implemented but browser-untestable until then. |
| 4 — Station Crafting Queue Integration | ✅ Done (2026-07-08, `deck-loop-rework`) | Owner-approved decisions: full `workstation`→`station` rename (data file, cardType, src, tests, CMS — incl. a zustand-persist v2 migration so CMS localStorage drafts survive the store-key rename); no default stations — stations arrive only via Phase 5 packs (console grants for testing); §4G buff plumbing built now, exercised by a throwaway `station_test_water_tower` card (+50% task speed, `areaId: null` keeps it out of every pack pool — delete once a real buff station is authored). New modules: `AreaModifiers.js` (per-area runtime aggregators — §4G drift: no "area's ModifierAggregator" existed before this), `StationSlotManager.js`, `StationManager.js` (ticks behind flag, right after LoopRunner), `ModeManager.js`. Smoke test verified in browser: crafting flow (Copper Ingot — ore + tag-resolved Fuel consumed from bank, ingots deposited, +5 industry XP/craft), production limit pause + resume on switch to infinite, input starvation → `paused_no_inputs` → auto-resume on resupply, passive buff live on a running card (3000ms→2000ms, exact 1.5×) + reverts on unslot + rehydrates after full save/load, station swap resets queue and frees the copy, single-copy rule, unowned/wrong-recipe-group/over-cap rejections, mid-combat and injured toggle guards, stationed↔adventure toggle. Flag-off regression: old grid boots, station card spawns/renders with recipe selector, no new console errors; CMS boots, migrates a legacy draft (v0→v2), Stations tab + StationEditor work. 77/77 tests pass. Note: §4H toggle→stationed is **refused while `in_combat`** (implementation decision — retreating mid-fight would dodge §3F's defeat pricing; revisit if a "flee" mechanic is ever wanted). |
| 5 — Unified Booster Shop & Card Collection | ✅ Done (2026-07-08, `deck-loop-rework`) | New: `DeckSlotManager` (§5C API incl. allocations spanning deck + station slots, plus `reconcileOwnership`), unified pack backend on `CollectionManager` (`buyUnifiedPack`/`claimToCollection`/pool/exhaustion — §5G's "already pools from all unlocked areas" was drift: the old code was per-area, and `globalPacksBought` didn't exist; unified cost is a placeholder curve in `loopConstants.js` UNIFIED_PACK, 50g + 10g/pack), TopBar Buy Pack button + unified branch of `PackOpeningOverlay`, `CollectionBinderModal` (grid, category tabs, sort, deployment filter, silhouettes, pips, Deployment Map + Add/Remove buttons; reuses preview gutter/tab nav/item/enemy bars). §5A gates landed (DeckSystem, LibraryManager, CardCraftingSystem, claimCard/buyPack). Gap found+fixed: authored default decks weren't owned in playsets — ownership granted at deck build (`grantDefaultDeckOwnership`) + load-time reconcile. First consumable cards authored (`data/cards/consumable/`, Blueberry/Blackberry Pie + CONSUMABLE preset), excluded from legacy pools flag-off — this made §3E browser-testable at last: verified live (pie consumed from bank, HP restored, loop wraps). Smoke test verified in browser: full buy→reveal→claim UI flow with cost scaling (50/60/70g), binder grid + Build-at-Outpost via UI, slot validations (unowned/duplicate/wrong-type/hazard), cap-at-4 pool removal, Sold Out button state (live-updating), flag-off regression (old grid, old modal, per-area packs, no consumables). 77/77 tests. **Deferred to Phase 6:** §5E drag-and-drop — there is no deck-slot UI to drop onto until the Deck Focus view exists (buttons cover the flow meanwhile); binder skill/area filter stack also lands with the Phase 7 drawer rebuild. |
| 6 — Frontend Layout & UI | ✅ Done (2026-07-08, `deck-loop-rework`) | New `src/ui/components/banner/`: `AreaBannerContainer` (rows per area; locked areas render as strips with unlock-quest progress — the §2G presentation decision), `AreaBannerRow` (static pillars + 80/20 split-banner center whose inactive slice click-toggles the mode; Station center shows output/controls/6 input chips with live bank counts), `BannerFocusViews` (Deck/Equip/Recipe focus morph the row inline, other rows dim; Deck Focus has slot pickers, per-slot remove, HTML5 drag reorder/swap and a drag-out-to-remove zone — the §5E leftovers; hazard slots render locked), `RefProgressBar` (§6D — direct DOM writes off `area:progress`, verified animating with zero React renders), CollapsedRow (§6E — internals fully unmounted). Engine support: `area:status_changed` event published on every loop/craft status transition (rows are fully event-driven, §2F payload-filtered), `LoopRunner.pauseArea/resumeArea` (manual stop/start survives auto-start). Hero assignment via an inline picker on the Hero Slot (drawer drag lands in Phase 7). Equip Focus includes equip-from-bank + click-unequip (found `EquipmentGrid.jsx` was dead code with imports that never existed — left marked for Phase 9). Smoke test verified in browser: row renders with live vitals/status, Deck Focus remove + picker re-add + swap, Equip and Recipe Focus, dimming (3 locked rows at opacity-30 during focus), split-banner toggle both directions (correctly refused mid-combat), collapse/expand, stop/start, ref-bar animating (86.5%→94% sampled), 60 FPS, locked-area quest progress bars live, sidebars intact, zero console errors. Flag-off regression: old grid + board cards render, no banner/pack UI leakage. 77/77 tests. Presentation note: the Active Card cell uses a compact placard (name/action/progress) rather than the full `ActiveCardFace` — full-size card faces made rows ~3× taller; the full face still serves pack reveals. Revisit with the owner if they want big card art in rows. |
| 7 — Bottom Folder Drawer UI & Sidebar Retirement | ✅ Done (2026-07-08, `deck-loop-rework`) | Owner decisions (2026-07-08): Collection Binder has **no gameplay purpose** — it's a completionist stat gallery (absorbs the Codex; `CollectionModal` retired flag-on, its TopBar button opens the binder); **no Stations tab** — stations are a filter in the Cards tab; **tavern retired outright** — the Heroes tab covers roster + bench + recruitment. New `src/ui/components/drawer/` (BottomFolderDrawer + Heroes/Cards/Bank tabs, three-pane §12.A layout) + `nativeDrag.js` (deck-loop drag uses native HTML5 events per the Phase 6 pattern; dnd-kit stays legacy-only). Shared binder pieces extracted to `modals/library/` (binderCatalog.js, BinderCardTile, DeploymentPanel → Cards tab). Engine: `collection.cardUseCounts` tallied at LoopRunner completions + StationManager crafts (binder "times performed"); drawer recruitment (`state.recruitment.candidates` + `RecruitSystem.rollCandidates/hireCandidate` — candidates persist so reopening can't reroll; hire pays scaled Influence, dismisses the rest; `retireHero`'s board recruit-card spawn gated flag-off). NOTE for owner: recruiting is now available on demand (legacy only spawned recruit cards on retirement) — the +2/hire cost curve is the only throttle; revisit at balancing. Drag: hero→Hero Slot (assign/swap), card→Deck Focus slot, station→Station Slot, item→Hero Slot/Equip Focus gear. Auto-open (§12.B): empty Hero Slot → Heroes tab, empty Station Slot → Cards tab pre-filtered to available stations; deck slots keep the Phase 6 inline picker (faster than a drawer roundtrip — presentation decision); Phase 6's HeroPicker stopgap removed. Gaps found by smoke test & fixed: (1) fresh new game flag-on booted to an EMPTY center — nothing built areaStates for unlocked areas (all prior phases tested on saves that already had them); `EngineBootstrap.onSlotSelected` now ensures them. (2) `bypassClone` subscriptions never re-rendered on in-place state mutation — binder/Cards tab went stale on deck/collection changes; fixed with deepClone snapshots + value-projection selectors (drawer hero vitals too). (3) `useGameState` selectors read GameState **accessors** — added missing `recruitment` (and `cardUseCounts`) getters. (4) Pre-existing: TopBar gold/influence only refreshed on `currency_changed`, so after boot the HUD showed 0 gold and silently disabled the pack shop until the first transaction (this was Phase 1's "0 gold" mystery) — now also listens to `state_changed`. Smoke test verified in browser, full fresh-game arc: new game → drawer recruit (3 candidates, hire, influence 10→0, cost scaling to 12) → deploy via inspection button → loop auto-runs (combat, energy pause + regen auto-resume observed) → Bank tab sell (+gold) → Buy Pack → claim → Cards tab reflects; drag-and-drop verified via real DragEvent dispatch (card→empty deck slot, item→hero slot equips food); binder progress bars (7/16 collected) + live lifetime stats (times performed ticking); save/load roundtrip (equipment, deck, counters, claim, auto-resume). Flag-off regression: old sidebars/tavern/codex/quest panel intact, no drawer leakage, only the pre-existing NaN progress-bar warnings. 77/77 tests. |
| 8 — Time Bank (offline fast-forward) | ✅ Done (2026-07-08, `deck-loop-rework`) | **Scope pivot (owner decision 2026-07-08):** the original math-only Offline Progress *Simulator* is **deferred** — projecting offline progression is too complex before the game's systems are finalized (you'd be simulating a moving target). Replaced with a **Time Bank**: offline time is banked (cap 24h) and spent by accelerating the LIVE engine, so there's no parallel simulation to maintain. Essentials only this pass (owner: "set up the essentials, revisit later"). New: `src/config/loopConstants.js` TIME_BANK (24h cap, presets [2,5,10]), `state.time.timeBankMs` (persisted, defensive default for pre-P8 saves), `TimeBankManager.js` (accrue-on-load via `game_loaded`+`savedAt`, start/stop spending, drain tick), `hud/TimeBankWidget.jsx` (flag-on TopBar control). Accrual uses the save's `savedAt` (now forwarded on `game_loaded`). Acceleration = plain `TimeManager.setTimeScale(N)` (approach #1); presets cap at 10x because every loop duration is ≥1s, so at 10 ticks/s a ≤10x scale still gives ≥1 tick/action without raising tick frequency — true 100x needs the deferred tick-faster/catch-up work. Drain model (owner-confirmed, approximate): bank drains by full game-time advanced (realDelta×N), so 24h plays out in ~24h/N real (~2.4h @10x). Smoke test verified in browser flag-on: loaded a ~4.77h-old save → banked 4h46m; 10x for 3.0s advanced game-time exactly 30000ms (10.00×) and drained the bank 30000ms; auto-stop at empty (scale→1); UI buttons drive start/stop with live widget; empty-bank guard (disabled presets + refused start). Flag-off regression: boots clean, no Time Bank UI, only pre-existing NaN-width warnings; 77/77 tests. **Known caveat (pre-existing, flagged):** combat's internal pacing (`CombatProcessor`) may not fully scale under large deltas, so long fights don't speed up proportionally to the loop — orthogonal to the Time Bank, revisit with combat. Balance Tester bullet dropped from this pass (deferred with the simulator). |
| 9 — Legacy Cleanup Sweep | ✅ Done (2026-07-17, `deck-loop-rework`) | **The rework is complete — the deck loop is the only system.** `USE_DECK_LOOP` removed (115 refs / 37 files unwound; featureFlags.js kept empty for future flags). Deleted ~60 files: the full roadmap list (grid layers, CardView/DeckCardView, old sidebars/tavern, retired modals, DeckSystem/LibraryManager/CardStackManager) plus stragglers flagged along the way — dormant `systems/combat` trio + CombatSystem, ThreatSystem/InvasionManager/invasion processors + threat counters (owner decision 2026-07-17: delete now, chaos redesign will rebuild), AreaSystem (board switcher), ExplorationManager, CardSystem/PackSystem/ModuleProcessors/CardCraftingSystem, old dnd (`systems/dnd/`, ui DndProvider, nativeDrag — absorbs DnD rework Step 4), quest card-modules, EquipmentGrid, spatial layout orphans (layoutConstants, CoordinateUtils, InteractionOverlay/PropsLayer/TableFXLayer/OffScreenIndicators, BannerFocusViews). Schema: `grid`/`threats`/`globalQuests`/`library`/`cards.active`/`cards.library` removed (cards keeps `idCounter`); 0.2.0 version gate + legacy-areaState graft kept. QuestTracker/CollectionManager/RecruitSystem/LifecycleProcessor rewritten to live paths only; HeroInspection extracted from deleted HeroesTab. **CMS included** (owner decision): Playmat view + Playmat/PlaymatGrid editors deleted, gridConfig dropped from export. Fixes found by sweep: TimeBankWidget was UNREACHABLE flag-on (its only mount was the retired TopBar) — re-homed top-right in the HUD (placement provisional, owner to review); dead "Customize" hero button removed (opened a modal that never mounted — drawer-native rename/avatar UI is future work). Tests: legacy suites deleted, CollectionManager.test rewritten for unified packs — **81/81 green** (was 83/98). Smoke test verified in browser, fresh game: boot (state carries no grid/threats/cards.active) → hire (Guild Hall Recruitment) → deploy → loop 2 laps (loot, energy draw cost, combat hand-off victory + auto-resume) → unified pack 50g→60g buy/flip/claim → save (9.4KB flyweight) → reload/load full continuity → Time Bank accrued 17s offline + 2x spend drained exactly 2×realtime; zero console errors (pre-existing NaN bar warnings gone with the legacy components); CMS boots, Areas editor renders, no playmat UI. Station crafting not re-exercised (no station owned on a fresh save; station code untouched beyond comments). |

**Working branch:** `deck-loop-rework` (created off `main` on 2026-07-07). Do not implement on `main` or `overhaul-dev`.

---

## Broad Phase Overview

```
┌──────────────────────────────────────┐
│  Phase 0: Safety Infrastructure      │ ◄── NEW: Feature flag + version bump
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 1: Feature Deprecation        │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 2: Data Schema & State Rework │ ◄── EXPANDED: Collection, hero assignment, perf foundations
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 3: Backend Loop Engine        │ ◄── EXPANDED: Multi-area ticking, energy, bootstrap, perf
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 4: Station Crafting Engine    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 5: Unified Booster Shop       │ ◄── EXPANDED: DeckSystem/Library retirement
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 6: Frontend Banner Rows & UI  │ ◄── EXPANDED: Perf-aware rendering patterns
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 7: Bottom Folder Drawer UI    │ ◄── Sidebar retirement happens here
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 8: Offline Progress & Polish  │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 9: Legacy Cleanup Sweep       │ ◄── NEW: Delete old grid code only after everything works
└──────────────────────────────────────┘
```

---

## Detailed Phases

### Phase 0: Safety Infrastructure *(NEW)*

The purpose of this phase is to make it **impossible to accidentally break the existing game** while building the new systems. We do this by adding a simple on/off switch that lets us run either the old playmat or the new deck loop system.

#### -1. Pre-Phase Repository Cleanup *(NEW)*
> [!NOTE]
> **Gap-analysis finding:** at the time this revision was written, there was an unrelated, uncommitted, in-flight effort consolidating the old 2D grid into a single global stitched playmat (touching `AreaSystem.js`, `AreaStateManager.js`, `cms/src/components/editors/AreaEditor.jsx` / `PlaymatEditor.jsx`, and related registries). **Decision: this uncommitted work is abandoned, not finished** — the entire grid system it improves is deleted in Phase 9 anyway, so there is no value in completing it first.
*   Before starting Phase 0 work: discard/revert the uncommitted changes to grid- and playmat-related files so Phase 1 gates a clean baseline. Confirm with the user before discarding anything, per standard git safety practice — this is a destructive operation on in-progress work.

#### A. Version Bump
*   Bump `GAME_VERSION` from `'1.0.0'` to `'0.2.0'` in [StateSchema.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/StateSchema.js) to reflect the alpha milestone shift.
*   **[DECISION] Save compatibility: breaking change, not migrated.** The existing save migration pipeline ([SaveMigration.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/SaveMigration.js)) only does a shallow top-level key merge, and its versioned-migration body (`if (savedVersion !== GAME_VERSION)`) is an empty `// TODO` stub. Writing real migration logic to reshape `cards.active`/`cards.library` and old area state into the new schema is out of scope for this rework.
    *   **[NEW]** In `SaveMigration.js`, replace the empty TODO block with an explicit incompatibility check: if `savedVersion` predates `0.2.0`, do **not** attempt a structural merge — surface a "this save is from a previous version and cannot be loaded; please start a new game" message and refuse to load, rather than silently loading a save with stale nested shapes (`state.cards.active`, old `areaStates` fields) that the new code doesn't read.
    *   This is acceptable because the game is pre-launch/alpha; there is no player base whose progress must be preserved across this schema change.

#### B. Feature Flag
*   **[NEW] Feature flag file (`featureFlags.js`):**
    *   Contains a single toggle: `USE_DECK_LOOP = false`.
    *   When `false`: the game boots and runs exactly as it does today (grid, sidebars, card system).
    *   When `true`: the game boots the new Area Banner Row layout and the LoopRunner instead.
*   **[MODIFY] [EngineBootstrap.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EngineBootstrap.js):**
    *   Gate the old `card_system` tick handler behind `!USE_DECK_LOOP`.
    *   Gate the new `LoopRunner` tick handler (once built) behind `USE_DECK_LOOP`.
*   **[MODIFY] [ReactRoot.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/ReactRoot.jsx):**
    *   Gate the center content: render `CardView` (old playmat) when flag is off, render `AreaBannerContainer` (new) when flag is on.
    *   Existing sidebars (`HeroView`, `InvView`, `TavernDrawer`) remain visible in both modes until Phase 7.

#### C. Git Branch Strategy
*   All rework happens on a dedicated `deck-loop-rework` branch. The `main` branch stays untouched and playable at all times.

#### ✅ Smoke Test
*   Game boots and plays identically with `USE_DECK_LOOP = false`. Flipping to `true` shows a placeholder "Deck Loop Mode" message in the center area — no crashes.

---

### Phase 1: Feature Deprecation & Retirement Gating

Before introducing new systems, we isolate and disable legacy 2D spatial features and card-level attachments, while preserving core drag-and-drop hit-testing logic for repurposing. **Nothing is deleted in this phase — only commented out or gated behind the feature flag.**

#### A. Code to Gate Behind Feature Flag (Not Delete)
*   **Card Gutter Slots:** Comment out all logic relating to dragging Heroes or items *onto* individual task cards (since heroes now attach to the Area, and inputs are consumed implicitly from the bank).
*   **2D Grid Geometry Layer:**
    *   [StaticGridLayer.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/StaticGridLayer.jsx) — Gate behind `!USE_DECK_LOOP`.
    *   [GridCell.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/GridCell.jsx) — Gate behind `!USE_DECK_LOOP`.
    *   [SlotHUDLayer.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/SlotHUDLayer.jsx) — Gate behind `!USE_DECK_LOOP`.
    *   [PlaymatViewport.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/PlaymatViewport.jsx) — Gate behind `!USE_DECK_LOOP`.
*   **Legacy Card View Containers:**
    *   [DeckCardView.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/DeckCardView.jsx) — Gate behind `!USE_DECK_LOOP`.

#### B. Code to Repurpose (Modify & Keep)
*   **Drag-and-Drop Hit-Testing & Resolution (`DndRouter.js` & Resolvers):**
    *   *Gate:* 2D snapping bounds, panning restrictions, card-on-card stacking checks, and spatial adjacency logic.
    *   *Gate:* Card-level gutter target detection.
    *   *Keep & Adapt:* Bounding box hit-testing to detect drops on the Area Banner's slots:
        *   Drops on Hero Slot → Triggers Hero assignment resolver.
        *   Drops on Deck Slots → Triggers Deck slot assignment resolver.
        *   Drops on Station Slot → Triggers Outpost Station assignment resolver.
    *   *Salvage & Adapt (Card Reordering & Removal):*
        *   **Deck Swapping:** Dragging a card from Slot A and dropping it on occupied Slot B swaps their positions in the deck loop array.
        *   **Deck Removal:** Dragging a card out of a slot and dropping it onto the bottom drawer (or releasing it outside the row bounds) unslots the card, clearing the slot.
*   **Task Execution Core Logic (PRESERVE):**
    *   *Do NOT delete:* [WorkProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/WorkProcessor.js), [RequirementProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/RequirementProcessor.js), and [StatProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/StatProcessor.js).
    *   *Modify:* Redirect Hero lookup in `processWorkCycle` to resolve the hero from the parent Area rather than looking up a card-specific `assignedHeroId`.
    *   *Mute:* Disable tool durability reduction. Task cards will now check if the required tool category is equipped to the Area's assigned Hero rather than deducting points from the tool itself.
*   **Card Rendering Pipeline (PRESERVE — distinct from CardView.jsx):**

    > [!IMPORTANT]
    > **Clarification:** [CardView.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/CardView.jsx) (24KB) is the **entire playmat board component** — it handles grid layout, card positioning via `{x,y}`, and the overall board canvas. This component gets **replaced** by the Area Banner Row system and is gated behind `!USE_DECK_LOOP`.
    >
    > What we **preserve** is the **card rendering pipeline**: the [card-modules/](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/card-modules/) directory, individual card face components ([ActiveCardFace.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/ActiveCardFace.jsx)), sprite rendering, progress bar ticks, headers, and descriptions. These get reused inside the Area Banner's active card slot.

*   **Combat Logic & Pacing (Repurpose):**
    *   *Gate:* Legacy code handling post-battle timers and spatial encounter pauses.
    *   *Note:* The transition pacing between fights is now handled globally by the `LoopRunner` Draw/Shuffle intermission timers.
*   **Quest Logic (Repurpose — Scope Revised):**
    *   **[DECISION] Quest cards are NOT slotted into Area Deck loops.** Gap analysis found quest tracking today has three divergent paths ([QuestTracker.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/QuestTracker.js): legacy global quests, physical board quest cards, and area-unlock progress). Design clarification: quest cards exist **only on locked Areas**, as the unlock requirement for that Area — they are never part of a running deck loop and are never dragged/reordered like task cards. See Phase 2G for the consolidation plan.

#### C. Systems to Mute (Keep Source Code)

*   **Chaos, Threat, Invasion, & Event Spawning:**
    *   *Action:* Gate the event subscribers and managers behind `!USE_DECK_LOOP` so they don't try to spawn cards onto a grid that no longer exists.
    *   *Note:* Keep all files and core simulation logic intact so they can be re-engineered for the deck loop system later.

#### D. Layout Prep
*   **Cleanups:**
    *   [layoutConstants.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/layoutConstants.js) — Gate spatial layout variables (`PLAYMAT_PADDING`, `PLAYMAT_GAP_X`) behind `!USE_DECK_LOOP`. Add new constants for banner row dimensions.

#### ✅ Smoke Test
*   `USE_DECK_LOOP = false`: Game still boots, plays, and looks identical to before. All old features work.
*   `USE_DECK_LOOP = true`: Game boots to a placeholder screen. No crashes. Old grid code is simply not rendered.

---

### Phase 2: Core Data Schema & State Rework

Refactoring the JSON registries and defining the new state model for Areas, Decks, Outposts, and the unified card collection. **This phase also establishes the performance foundations** that every later phase builds on.

#### A. Unified Card Collection Model *(NEW)*
The old `cards.active` / `cards.library` split is **retired**. All owned cards now live in a single collection. Think of it like a binder of trading cards — you own copies, and you slot them into area decks from your binder.

*   **[MODIFY] [StateSchema.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/StateSchema.js):**
    *   Replace the `cards.active` / `cards.library` arrays with a new `collection.ownedCards` structure: `{ [templateId]: { count: number, maxCopies: 4 } }`.
    *   Remove `cards.limits.boardMax` (no more board).
    *   Keep `cards.idCounter` for any remaining instance-based needs.
*   **[MODIFY] [GameState.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/GameState.js):**
    *   Remove grid-specific accessors: `getCardAt(x, y)`, `getValidAdjacentEmptyCells()`.
    *   Remove `get grid()` accessor.
    *   Update `rebuildCardCache()` to walk per-area deck slot arrays instead of `cards.active`.
    *   Update `serialize()` and `CARD_PROPS_TO_STRIP` to handle deck-slot metadata instead of position metadata.
    *   Add new accessors: `getAreaDeck(areaId)`, `getActiveCardForArea(areaId)`, `getHeroForArea(areaId)`.
*   **Impact:** [DeckSystem.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/DeckSystem.js) and [LibraryManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/LibraryManager.js) become obsolete. They are **not deleted yet** — just gated behind `!USE_DECK_LOOP` and replaced by a new `DeckSlotManager.js` (see Phase 3).

#### B. Area Data Registries
*   **[MODIFY] [areas.json](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/cards/area/areas.json):**
    *   Strip `gridConfig`, `validCells`, and default templates.
    *   Add `deckSlots` structure with `specializedTags`, default `stationCardId`, and starting locked/hazard slots (see §2C for the hazard slot data shape).
    *   **[NEW]** Add `unlockQuestId` (or equivalent) for locked Areas — replaces the old `activeQuestProgress` ad-hoc tracking referenced from `AreaStateManager.js` (see Phase 2G).

#### C. Area State Schema (Per-Area Runtime Data)
*   **[MODIFY] [AreaStateManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/area/AreaStateManager.js):**
    *   `ensureAreaState()` creates the new shape:
        *   `assignedHeroId` — which hero is assigned to this area *(NEW)*
        *   `deckSlots` — array of `{ templateId, slotType, isLocked }` objects
        *   `activeCardIndex` — which slot is currently executing
        *   `executionTimer` — ticks down current card's task time
        *   `mode` — `'adventure'` or `'stationed'`
        *   `status` — `'running'`, `'paused'`, `'injured'`, `'drawing'`, `'shuffling'`
        *   `stationState` — `{ activeStationCardId, craftingQueue, ... }`
        *   `_dirtyStats` — per-area dirty flag for stat recalculation *(PERF)*
    *   Preserve existing fields that are still relevant: `mastery`, `explorationCount`, `collectionProgress`, `completedQuestIds`.

#### C-1. Hazard Slot Mechanic *(NEW — In Scope, Mitigation Deferred)*

> [!NOTE]
> **Design decision:** Basic hazard slots ship in this rework since they're core to an Area's identity/difficulty. Only the **mitigation** path (Area Skill Tree nodes that weaken/remove hazards, concept doc §5) is deferred — a hazard slot is simply always "on" until skill trees land in a future pass. Gap analysis confirmed no existing code implements this (only one cosmetically-named Event card, `eventRegistry.js`, and an unrelated visual `hazard` style preset in `ProgressBar.jsx`) — this is new logic end to end.

*   **Hazard deck slot entry shape (extends the flyweight shape from §2E):**
    ```js
    {
      templateId: null,               // Hazard slots have no player-assignable card
      slotType: 'locked',
      isLocked: true,
      hazard: {
        type: 'poison',                // poison | fire | bleed | slow | etc.
        damagePerPass: 8,               // flat HP damage applied when the loop reaches this slot
        tickTime: 2000                 // ms the hero "spends" in the hazard slot (still costs loop time)
      }
    }
    ```
*   **[NEW]** `LoopRunner` treats a hazard slot as a special zero-choice slot: on reaching it, apply `hazard.damagePerPass` to the assigned hero (routed through the same defeat/HP-check path as combat, see §3I), hold for `hazard.tickTime`, then advance — no card execution, no inputs/outputs.
*   **[NEW]** Hazard slots are authored per-Area in `areas.json` (see §2H for the CMS authoring tooling) and are permanent/non-removable by the player, matching the concept doc's "environmental hazard" framing.

#### D. Hero ↔ Area Assignment *(NEW)*
*   **[NEW] Hero-Area binding logic** (in `AreaStateManager.js` or a new `HeroAssignmentManager.js`):
    *   `assignHeroToArea(heroId, areaId)`:
        *   If the hero is already assigned to a different area → auto-unassign from the old area first and reset that area's loop.
        *   Set `areaStates[areaId].assignedHeroId = heroId`.
        *   Reset `activeCardIndex` to 0 and `executionTimer` to 0 (loop always restarts from scratch).
    *   `unassignHero(areaId)`:
        *   Clear `assignedHeroId`, pause the loop.
*   **Loop Reset Rule:** Any change to an area's deck contents, assigned hero, or hero equipment triggers a full loop reset for that area (index back to 0, timer back to 0). This ensures deterministic behavior.

#### E. Flyweight Deck Slot Entries *(PERF)*

> [!IMPORTANT]
> **Optimization Rule — enforced from this phase forward.**
> Deck slot entries must be **lightweight references**, not full copies of card data. All template data (name, description, icon, traits, outputs) stays in the shared card registry and is looked up on demand. This keeps memory low and equality checks fast as the game scales to hundreds of cards.

*   **Deck slot entry shape (lean — this is all that gets stored per slot):**
    ```js
    {
      templateId: 'task_chop_wood',    // Reference to shared template
      slotType: 'regular',             // regular | specialized | boost | locked
      specializedTags: [],             // e.g. ['fishing'] for a Fishing Slot
      isLocked: false,                 // true for environmental hazard slots
      // --- Runtime fields (only exist while loop is running) ---
      progress: 0,                     // How far through this card's task time
      status: 'idle'                   // idle | active | completed
    }
    ```
*   **Template data (shared, read-only — looked up from registry, never copied onto slots):**
    ```js
    cardRegistry.get('task_chop_wood')
    → { name, description, icon, traits, baseTickTime, outputs, energyCost, ... }
    ```
*   **Enforcement:** `DeckSlotManager.slotCard()` must never clone template properties onto the slot object. The LoopRunner and UI components call `cardRegistry.get(slot.templateId)` when they need template data.

#### F. Area-Scoped Event Convention *(PERF)*

> [!IMPORTANT]
> **Optimization Rule — enforced from this phase forward.**
> The old pattern of broadcasting generic events like `'inventory_updated'` or `'cards_updated'` to the entire game causes every card in every area to recalculate. With 12 areas running simultaneously, this creates a cascade where one area finishing a task forces all 120+ cards to recheck their stats — wasting 11/12ths of the work.
>
> The new system uses **area-scoped events** so only the affected area reacts.

*   **New naming convention:** `area:<event_name>` with an `{ areaId }` payload.
    *   `area:deck_updated` — a card was slotted/unslotted/swapped in this area's deck
    *   `area:card_completed` — the active card finished its task in this area
    *   `area:hero_changed` — the hero assignment or equipment changed for this area
    *   `area:stats_dirty` — this area's cards need stat recalculation
    *   `area:mode_switched` — this area toggled between adventure/stationed
*   **Global events are still used** for truly global changes (e.g. `inventory_updated` when the bank contents change from any source, `collection_updated` when a pack is opened). But these global events should **not** trigger per-card stat recalculations — only the area-scoped events do that.
*   **UI subscription pattern:** Each `AreaBannerRow` component subscribes to events filtered to its own `areaId`. It ignores events from other areas entirely.

#### G. Quest System Consolidation *(NEW)*

> [!NOTE]
> **Design decision (locked in):** Quest cards exist **only on locked Areas**, as the unlock requirement for that Area. They are never slotted into a running Area Deck loop, never reordered, never interacted with like task cards. Gap analysis found `QuestTracker.js` currently has three divergent tracking paths for what should be one concept — this phase consolidates them.

*   **[MODIFY] [QuestTracker.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/QuestTracker.js):**
    *   Retire the **physical board quest card** path (`state.cards.active` quest cards, `completeBoardQuest()`) — quest cards no longer exist as board/deck entities at all under `USE_DECK_LOOP`.
    *   Retire the **legacy global quests** path (`state.globalQuests`) by folding any still-relevant global objectives into the area-unlock model, or explicitly cutting them if they're found to be unused content during implementation (flag for user review rather than silently dropping).
    *   Keep and generalize the **area-unlock progress** path (`areaStates[areaId].activeQuestProgress`) as the **single remaining quest model**: a locked Area has one unlock quest, tracked via `ObjectiveRegistry.evaluate` against `targetEvent`/`targetId`/`maxProgress` from `data/quests.json`, with no card/board representation.
*   **[MODIFY] [data/quests.json](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/quests.json):** Audit entries for any that assumed a board-card representation; ensure every entry maps to an Area's `unlockQuestId` (§2B) or is cut.
*   **UI implication:** the unlock quest's progress is likely surfaced as part of the locked Area's banner (a progress indicator on the still-locked row), not as a card — exact presentation is a Phase 6 UI decision, not a Phase 2 one.

#### H. CMS Authoring Tooling for Deck Slots & Stations *(NEW)*

> [!WARNING]
> **Gap analysis finding:** [AreaEditor.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/cms/src/components/editors/AreaEditor.jsx) currently has **zero tooling** for authoring `deckSlots`, `specializedTags`, hazard slot config, or station data — its existing "layout" section is a stub that hands off to a separate Global Playmat Editor (which is itself being retired, not extended). Every schema change in §2B/§2C/§C-1 needs a corresponding editor UI, or designers will be hand-editing `areas.json` JSON directly, which doesn't scale and isn't how this CMS is meant to be used.

*   **[NEW] Deck Slot Editor panel** (replaces the old grid/layout stub in `AreaEditor.jsx`):
    *   A simple ordered-list editor for an Area's `deckSlots` array: add/remove/reorder slot entries, set `slotType` (regular/specialized/boost/locked), set `specializedTags`, and for `locked` slots, configure the hazard shape from §C-1 (`hazard.type`, `damagePerPass`, `tickTime`).
    *   Set the Area's default starting deck contents (which `templateId`s are pre-slotted for a fresh unlock).
*   **[NEW] Station authoring:** extend the card editor (wherever `data/cards/**` entries are authored in the CMS today) to support the new `cardType: 'station'` shape from §4A (`hasCraftingQueue`, `recipeGroup`, `skillCap`, `passiveBuff`).
*   **Sequencing:** this tooling should land alongside or immediately after §2B/§2C so that Phase 2's smoke test (below) can be validated by actually authoring a test Area's deck in the CMS, not just by hand-writing JSON fixtures.

#### ✅ Smoke Test
*   `USE_DECK_LOOP = false`: Old game still works (old state shape is untouched behind the flag).
*   `USE_DECK_LOOP = true`: Can create a new game with the new state shape. `ensureAreaState` returns the correct new structure. Deck slots contain only `templateId` + runtime fields (no template bloat). No ticking yet — just data.
*   A designer can open the CMS, author a test Area's `deckSlots` (including one hazard slot) and a station card, and see the resulting JSON match the schema — without hand-editing `areas.json`.
*   A locked Area shows unlock-quest progress tracked purely via `areaStates[areaId].activeQuestProgress` — no quest card exists on any board/deck.

---

### Phase 3: Backend Loop Engine (Adventure Runner)

Building the logic that processes the linear deck loop sequentially in Adventure Mode. **All unlocked areas with assigned heroes tick simultaneously.** This phase bakes in the performance-critical patterns that make 12-area scaling viable.

#### A. Sequential Loop Runner (with Fast-Path Ticking) *(PERF)*
*   **[NEW] `LoopRunner.js`:**
    *   Registered as a tick handler in [EngineBootstrap._registerTickHandlers()](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EngineBootstrap.js#L97-L133) — **only when `USE_DECK_LOOP` is `true`**.
    *   **Multi-area ticking:** Each tick, the runner iterates over *every unlocked area* that has an assigned hero and is in `'running'` status. Each area's loop is advanced independently.
    *   Integrates with [WorkProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/WorkProcessor.js) to process the active card slot's execution cycle.
    *   On task completion: increments the index (`activeCardIndex = (activeCardIndex + 1) % deckSize`) and transitions to the next card.
    *   Handles loop wrap-around: last card → shuffle phase → first card.

> [!IMPORTANT]
> **Fast-Path Tick Design** — The tick loop must distinguish between **countdown ticks** (99% of ticks — just subtract delta from a timer, costs almost nothing) and **completion ticks** (the rare moment a card finishes and triggers real work). This is what makes 12 simultaneous areas affordable.
>
> ```
> LoopRunner.tick(delta):
>   for each area:
>     1. Is area running with a hero? If not → skip.              [O(1)]
>     2. Subtract delta from area.executionTimer.                  [O(1)]
>     3. Timer still positive? → DONE, next area.                  [O(1)] ← 99% of ticks stop here
>     4. Timer hit zero → do the expensive work:                   [Rare]
>        - Complete current card (process outputs, consume inputs)
>        - Advance activeCardIndex
>        - Load next card template from registry
>        - Begin draw/shuffle intermission if needed
>        - Queue events into the EventBatch (see section G)
> ```

#### B. EngineBootstrap Integration *(NEW)*
*   **[MODIFY] [EngineBootstrap.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EngineBootstrap.js):**
    *   Import `LoopRunner` and `StationManager`.
    *   In `_registerTickHandlers()`:
        *   Gate old `card_system` tick behind `!USE_DECK_LOOP`.
        *   Register `LoopRunner.tick(delta)` at priority 50 (runs after time tracking, before UI updates) behind `USE_DECK_LOOP`.
        *   Register `StationManager.tick(delta)` at priority 55 behind `USE_DECK_LOOP`.
    *   In `getEngine()`: expose `LoopRunner` and `StationManager` so UI components can access them.
    *   In `onSlotSelected()`: gate `AreaSystem.initGridForArea()` calls behind `!USE_DECK_LOOP`.

#### C. Loop Pacing Manager
*   **[NEW] Pacing logic (inside `LoopRunner.js` or separate `PacingManager.js`):**
    *   **Draw Time** (1–2s delay between card transitions).
    *   **Shuffle Time** (5–10s delay when wrapping from last card back to first).
    *   Area `status` transitions: `'running'` → `'drawing'` → `'running'` → ... → `'shuffling'` → `'running'`.

#### D. Energy Draw Cost *(REVISED — existing system tweaked)*
*   **[MODIFY] Energy consumption in `WorkProcessor.js` or `LoopRunner.js`:**
    *   When drawing a card, check if the hero has enough Energy to pay the card's flat draw cost.
    *   If enough: deduct Energy, begin card execution.
    *   If insufficient: **pause the loop** for that area (set status to `'paused'`). Loop auto-resumes when the hero's passive Energy regen refills enough to pay the cost.

#### E. Consumable Consumption & Skip Handler
*   **[NEW] Consumable logic (in `LoopRunner.js`):**
    *   Check global bank quantities.
    *   If available: deduct 1 unit from bank, trigger **3-second Consumption Time**, apply effect.
    *   If unavailable: skip effect but still trigger **3-second Consumption Time** penalty.

#### F. Defeat & Forced Retreat State Machine
*   **[NEW] Defeat handler:**
    *   Listen to hero combat outcomes.
    *   On HP reaching 0: Pause loop → Toggle mode to `stationed` → Apply `[Injured]` status condition.
    *   Calculate death penalties: deplete active consumable stacks in the loop, check gear breakage chance, and permanently delete equipment assets if triggered.

#### G. Area-Scoped Dirty Flags for Stat Recalculation *(PERF)*

> [!IMPORTANT]
> **Optimization Rule:** When something changes that affects card stats (hero equipment, tool swap, area modifier), only the affected area's `_dirtyStats` flag is set to `true`. The LoopRunner recalculates stats **only for that area's ~10 deck slots** on the next tick, not all 120+ cards globally.

*   **How it works:**
    *   When `area:hero_changed` fires for Oak Forest → set `areaStates['area_oak_forest']._dirtyStats = true`.
    *   In `LoopRunner.tick()`, before processing each area:
        ```
        if (area._dirtyStats) {
            recalculate stats for ONLY this area's deck slots
            area._dirtyStats = false
        }
        ```
    *   This replaces the old pattern where `recalculateAllCardStats()` walked every active card in the entire game.
*   **[MODIFY] [StatProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/StatProcessor.js):**
    *   Add `recalculateAreaStats(areaId)` — recalculates stats for only the deck slots belonging to a specific area.
    *   Keep `recalculateAllCardStats()` as a fallback but it should rarely be called.

#### H. Event Batch Coalescing *(PERF)*

> [!IMPORTANT]
> **Optimization Rule:** When a card completes, it can trigger a cascade of 5-6 events (`inventory_updated`, `cards_updated`, `heroes_updated`, etc.). With 12 areas completing tasks at different times, this can produce 30+ events per second, each causing its own UI re-render. Event batching collects all events during a tick and fires each unique event type **once** at the end.

*   **[NEW] `EventBatch.js` utility:**
    ```js
    // During card completion work:
    EventBatch.queue('inventory_updated', { areaId, items: [...] });
    EventBatch.queue('area:card_completed', { areaId });
    EventBatch.queue('heroes_updated', { heroId });

    // At the end of LoopRunner.tick():
    EventBatch.flush();
    // → Deduplicates: fires inventory_updated ONCE even if 3 areas completed tasks
    // → Merges payloads where possible
    ```
*   **Integration:** `LoopRunner.tick()` calls `EventBatch.begin()` at the start and `EventBatch.flush()` at the end. All systems called during the tick use `EventBatch.queue()` instead of `EventBus.publish()` for events that can be batched.
*   **Non-batchable events** (like `audio:play`) continue using `EventBus.publish()` directly since they need immediate execution.

#### I. Combat Card Handling (Hand-off Model) *(NEW)*

> [!IMPORTANT]
> **Gap analysis finding:** combat does not fit the generic "flat countdown timer" tick model the rest of this phase describes. The existing [CombatTickProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/combat/logic/CombatTickProcessor.js) runs independent hero/enemy attack-speed counters, RNG-based attack resolution, and HP checks after each exchange — a fundamentally different shape than [WorkProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/WorkProcessor.js)'s single-progress-bar model.
>
> **Design decision (locked in): hand-off, not reimplementation.** `LoopRunner` does not try to model combat as a countdown. When the loop reaches a combat card slot, it pauses that Area's loop entirely and delegates to the existing, unmodified `CombatSystem`/`CombatTickProcessor`. Control returns to `LoopRunner` only when combat resolves.

*   **[MODIFY] `LoopRunner.tick(delta)`:** add a branch before the fast-path countdown check — if the active slot's card is `cardType: 'combat'` and `areaState.status !== 'in_combat'`, transition `status = 'in_combat'` and hand the card off to `CombatSystem` (reusing the existing hero-vs-enemy resolution path, e.g. the `CombatManager`/`transformToCombat` bridge already used by `WorkProcessor.completeWorkCycle`/`LootSystem.handleTaskReward`).
*   **While `status === 'in_combat'`:** `LoopRunner`'s fast-path skips this area entirely (no timer countdown) — `CombatTickProcessor` drives its own tick independently, exactly as it does today.
*   **On combat resolution:**
    *   *Victory:* `CombatSystem` calls back into `LoopRunner` (or publishes an `area:combat_resolved` event `LoopRunner` subscribes to) with the outcome. `status` returns to `'running'`, loot/XP is applied via existing `ResolutionProcessor.handleVictory`, and the loop advances `activeCardIndex` normally.
    *   *Defeat:* Routes into the existing Forced Retreat handler (§3F) — pause loop, switch to Stationed Mode, apply `[Injured]`.
*   **Hazard slot damage (§2C-1) reuses this same HP-check/defeat routing** — a hazard tick that drops the hero to 0 HP triggers the identical Forced Retreat path as a combat defeat, rather than a separate code path.
*   **Explicitly out of scope for this phase:** any *rebuilding* of combat internals (attack formulas, RNG, modifier aggregation) — those are preserved as-is. The only new code is the hand-off/pause/resume boundary in `LoopRunner`.

#### ✅ Smoke Test
*   `USE_DECK_LOOP = true`: Assign a hero to an area with a pre-configured deck. Watch the loop advance through cards sequentially, with draw/shuffle pauses. Multiple areas tick independently. Energy gate pauses the loop when depleted. Hero defeat triggers retreat.
*   **Combat hand-off:** Loop reaches a combat card slot → area status becomes `in_combat` → existing combat UI/logic resolves the fight with its normal multi-round pacing → on victory, loop resumes and advances to the next slot; on defeat, Forced Retreat triggers. Other areas' loops keep ticking normally while one area is `in_combat`.
*   **Hazard tick:** Loop reaches a locked hazard slot → hero takes `damagePerPass` damage → holds for `tickTime` → advances. If damage drops HP to 0, Forced Retreat triggers identically to a combat defeat.
*   **Perf check:** Open browser dev tools Performance tab. With 4+ areas ticking simultaneously, each tick should complete in under 5ms. Event log should show batched events firing once per tick, not dozens of individual events.

---

### Phase 4: Station Crafting Queue Integration

Implementing the Outpost system: Station Cards, crafting queues, passive area buffs, and the mode toggle between Adventure and Stationed.

> [!NOTE]
> **Design decisions for this phase:**
> - Station cards are **portable** — any station can be slotted into any area's Station Slot. The `areaId` on a station card only indicates which pack it drops from, not where it can be used.
> - Each area has **one Station Slot** — a hero can only work one crafting queue at a time.
> - Station cards can serve **dual purposes**: some provide crafting (Smelting Furnace), some provide passive area buffs (Water Tower), and some do both. **Passive buffs are always active when the card is slotted**, regardless of whether the hero is in Adventure or Stationed Mode. Crafting queues only run in Stationed Mode.

#### A. Station Card Data Schema

Station cards are a distinct card type with their own template shape. The existing [workstations.json](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/workstations.json) definitions will be migrated to this new format.

*   **Station card template shape:**
    ```json
    {
      "id": "station_smelting_furnace",
      "name": "Smelting Furnace",
      "cardType": "station",
      "description": "Smelt raw ores into refined ingots.",
      "areaId": "area_guild_hall",
      "sprite": "bg_forge",

      "hasCraftingQueue": true,
      "recipeGroup": "subskill_smelting",
      "skillCap": 90,

      "passiveBuff": null
    }
    ```
*   **Dual-purpose example (future):**
    ```json
    {
      "id": "station_water_tower",
      "name": "Water Tower",
      "cardType": "station",
      "areaId": "area_farmland",
      "sprite": "bg_water_tower",

      "hasCraftingQueue": false,
      "recipeGroup": null,

      "passiveBuff": {
        "type": "output_double",
        "target": { "category": "water" },
        "value": 0.15,
        "description": "15% chance to double Water outputs"
      }
    }
    ```
*   **Key fields:**
    *   `hasCraftingQueue` — `true` if this station supports Stationed Mode crafting. `false` for buff-only stations.
    *   `recipeGroup` — links to a `subskillId` in the recipe registry. All recipes with that `subskillId` are available at this station.
    *   `skillCap` — maximum recipe level this station can process. Higher-tier stations unlock higher-level recipes.
    *   `passiveBuff` — if present, this buff is applied to the area's `ModifierAggregator` whenever the card is slotted, regardless of mode. Uses the existing [Unified Modifier Interface](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js) format.

#### B. Workstation Data Migration

*   **[MODIFY] [workstations.json](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/workstations.json):**
    *   Rename to `stations.json` (or move existing workstation entries into a new `data/cards/station/` directory to match the card directory convention).
    *   Update each entry to the new station card template shape (add `cardType: "station"`, `hasCraftingQueue: true`, `passiveBuff: null`).
*   **[MODIFY] [cardRegistry.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/cardRegistry.js#L130-L164):**
    *   Update the workstation loading block to use the new schema. The `cardType` changes from `'workstation'` to `'station'`.
    *   Register station cards in the main `CARDS` registry like any other card type.
*   **[MODIFY] [CARD_TYPES](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/cardRegistry.js):**
    *   Add `STATION: 'station'` to the `CARD_TYPES` enum, replacing the old `'workstation'` string.
*   **Impact on existing code:** The `'workstation'` string is referenced in [ModularSyncer.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/assembler/ModularSyncer.js#L99), [theaterUtils.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/utils/theaterUtils.js#L121), and [areaSetRegistry.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/areaSetRegistry.js#L120). All references update to `'station'`.

#### C. Recipe Resolution (Adapted from Existing Logic)

The existing [evaluateWorkstationRecipe()](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/assembler/ModularSyncer.js#L16-L92) and [getRecipesBySubskill()](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/recipeRegistry.js#L69-L71) are preserved and adapted. The core change is that recipe selection is now **explicit** (player picks from a menu) rather than implicit (matching dragged items).

*   **[MODIFY] Recipe resolution flow:**
    1.  Player opens Recipe Focus View for a station → sees all recipes from `getRecipesBySubskill(station.recipeGroup)`, filtered by `skillCap`.
    2.  Player selects an output card → sets `areaState.stationState.selectedRecipeId`.
    3.  `StationManager` looks up the recipe by ID, checks if bank has required inputs, and begins processing.
*   **[GATE] Dynamic input-matching in `evaluateWorkstationRecipe()`:**
    *   The old fallback logic that scans `card.assignedItems` to dynamically match recipes (lines 37-73 of ModularSyncer) is **gated behind `!USE_DECK_LOOP`**. In the new system, the player always explicitly selects a recipe — no guessing from dragged items.
    *   The `selectedRecipeId` path (lines 31-34) is the primary path.
*   **[KEEP] [recipeRegistry.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/recipeRegistry.js):**
    *   `getRecipesBySubskill()` and `getRecipe()` remain unchanged — they're already the right shape.

#### D. Station Slot Management

*   **[NEW] `StationSlotManager.js` (or extend `DeckSlotManager.js`):**
    *   `slotStation(areaId, stationTemplateId)`:
        *   Checks if the player owns the station card in their collection.
        *   Sets `areaState.stationState.activeStationCardId = stationTemplateId`.
        *   If the station has a `passiveBuff` → registers the buff on the area's `ModifierAggregator` immediately (buff is active regardless of Adventure/Stationed mode).
        *   Clears any previous `selectedRecipeId` and crafting progress (swapping stations always resets the queue).
        *   Publishes `area:station_changed` event.
    *   `unslotStation(areaId)`:
        *   Removes the station card, returning it to the collection pool.
        *   If the station had a `passiveBuff` → removes it from the area's `ModifierAggregator`.
        *   If the area was in Stationed Mode → switches back to Adventure Mode (paused).
        *   Clears all `stationState` fields.
    *   `selectRecipe(areaId, recipeId)`:
        *   Validates the recipe belongs to the station's `recipeGroup`.
        *   Sets `areaState.stationState.selectedRecipeId = recipeId`.
        *   Resets crafting `progress` to 0.

#### E. Area State: Station Fields

*   **[MODIFY] [AreaStateManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/area/AreaStateManager.js)** — expand `stationState` in `ensureAreaState()`:
    ```js
    stationState: {
      activeStationCardId: null,    // templateId of the slotted station card
      selectedRecipeId: null,       // which recipe the player has chosen
      progress: 0,                  // ms of progress on current craft cycle
      productionMode: 'infinite',   // 'infinite' | 'limited'
      productionLimit: 0,           // target quantity (only used if mode is 'limited')
      producedCount: 0,             // how many have been crafted this session
      status: 'idle'                // 'idle' | 'crafting' | 'paused_no_inputs' | 'paused_limit_reached'
    }
    ```

#### F. Station Manager Tick Engine

*   **[NEW] `StationManager.js`:**
    *   Registered in [EngineBootstrap](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EngineBootstrap.js) at priority 55 (after LoopRunner at 50), gated behind `USE_DECK_LOOP`.
    *   **Tick logic (per area in Stationed Mode):**
        ```
        StationManager.tick(delta):
          for each area where mode === 'stationed' AND stationState.activeStationCardId exists:
            1. Is there a selectedRecipeId? If not → status = 'idle', skip.       [O(1)]
            2. Is status 'paused_limit_reached'? → skip.                          [O(1)]
            3. Look up recipe from recipeRegistry.get(selectedRecipeId).           [O(1)]
            4. Check bank for required inputs:
               - All inputs available? → Continue.
               - Any missing? → status = 'paused_no_inputs', skip.
            5. Subtract delta from stationState.progress.                          [O(1)]
            6. Progress still positive? → DONE, next area.                         [O(1)] ← fast path
            7. Progress hit zero → CRAFT COMPLETE:
               - Deduct inputs from inventory bank.
               - Deposit outputs to inventory bank.
               - Award XP to the assigned hero (recipe.xpAwarded, skill from recipe.subskillId → parentSkill).
               - Increment producedCount.
               - Check production limit:
                 - If productionMode === 'limited' AND producedCount >= productionLimit → status = 'paused_limit_reached'.
                 - Else → reset progress to recipe.baseTickTime, continue crafting.
               - Queue events: EventBatch.queue('inventory_updated'), EventBatch.queue('area:craft_completed', { areaId }).
        ```
    *   **Input checking uses the same global bank** that Adventure Mode deposits into. This is what enables the inter-area supply chain (heroes gathering raw materials in Adventure Mode feed the crafting queue in Stationed Mode).

#### G. Passive Buff Registration

*   **When a station with a `passiveBuff` is slotted into an area** (via `StationSlotManager.slotStation()`):
    *   Create a UMI (Unified Modifier Interface) object from the station's `passiveBuff` field.
    *   Register it on the area's `ModifierAggregator` using `addModifier()` with `source: stationTemplateId`.
    *   This modifier is **always active** — it applies during Adventure Mode (buffing deck loop cards) and during Stationed Mode.
*   **When the station is unslotted:**
    *   Call `removeModifiersBySource(stationTemplateId)` to cleanly remove the buff.
*   **This means a future Water Tower station slotted into the Farmland area would give a 15% double-water-output chance to every gathering card in that area's adventure deck**, even while the hero is running the adventure loop. The buff is a property of the station being *present*, not of the hero being stationed.

#### H. Mode Toggle (Adventure ↔ Stationed)

*   **[MODIFY] `AreaStateManager.js` or new `ModeManager.js`:**
    *   `toggleMode(areaId)`:
        *   If currently `'adventure'` → switch to `'stationed'`. Pause the adventure deck loop. StationManager begins ticking this area.
        *   If currently `'stationed'` → switch to `'adventure'`. Pause crafting (preserve progress). LoopRunner resumes ticking this area.
        *   If no station card is slotted → refuse the switch to Stationed Mode. Notify the player.
        *   If no hero is assigned → mode toggle has no effect (both modes require a hero).
    *   Publishes `area:mode_switched` event.
*   **Interaction with hero defeat (Phase 3F):**
    *   On hero defeat → auto-switch to Stationed Mode. The hero is injured and can't re-enter Adventure Mode until healed. Crafting can still run while the hero recovers (if a station card is slotted and a recipe is selected).

#### ✅ Smoke Test
*   **Crafting flow:** Slot a Smelting Furnace into an area's Station Slot. Switch the hero to Stationed Mode. Open Recipe Focus → select Copper Ingot. Verify Copper Ore is consumed from the bank and Copper Ingot is deposited. XP is awarded to the hero.
*   **Production limits:** Set production mode to `limited` with a cap of 10. Verify crafting pauses after 10 ingots. Switch to `infinite` → verify crafting resumes.
*   **Input starvation:** Run out of Copper Ore mid-craft. Verify status changes to `'paused_no_inputs'`. Have another area gather Copper Ore in Adventure Mode → verify crafting auto-resumes when ore appears in the bank.
*   **Passive buff:** Slot a buff-only station card (e.g., Water Tower). Verify the area's ModifierAggregator shows the buff. Switch between Adventure and Stationed Mode → verify the buff stays active in both modes. Unslot the station → verify the buff is removed.
*   **Station swap:** While crafting is in progress, swap the Smelting Furnace for a Blacksmith Forge. Verify crafting progress resets, recipe selection clears, and the new station's recipe list appears.

---

### Phase 5: Unified Booster Shop & Card Collection Overhaul

Reworking card acquisition and management: retiring the old deck/library/board split, building the Collection Binder, implementing the unified pack shop, and connecting cards to area deck slots.

> [!NOTE]
> **Design decisions for this phase:**
> - The old "playmat board" concept is retired. Cards are **never** loose on a surface — they live in the Collection Binder and are slotted into area deck slots from there.
> - The Collection Binder is a **grid-based card binder** (not a list), with tabs and sorting. Think of a physical trading card binder with pages of cards.
> - Cards move to/from area decks via **drag-and-drop** onto deck slots, or via **Add/Remove buttons** on the card itself in the Binder.
> - Pack opening is **instant** — a "Buy Pack" button on the TopBar opens a reveal panel. Selecting a card adds it directly to the Binder. No physical pack cards exist.
> - `CardCraftingSystem` is **legacy code** and will be retired. Discovery is implicit from ownership count.

#### A. Retire Legacy Card Management

Three systems are fully gated behind `!USE_DECK_LOOP` in this phase:

*   **[GATE] [DeckSystem.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/DeckSystem.js):**
    *   Gates `findOrCreateDeck()`, `addToDeck()`, `drawQuestFromDeck()`, and all pack/quest/chest deck creation behind `!USE_DECK_LOOP`.
    *   In the new system, packs are not physical board cards — they're purchased via the shop UI and resolve instantly.
*   **[GATE] [LibraryManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/LibraryManager.js):**
    *   Gates `canWithdraw()`, `performReclaim()`, and the old board-based `reconcileLocation()` behind `!USE_DECK_LOOP`.
    *   **Preserved for adaptation:** The `reconcileLocation()` pattern (checking where copies are deployed) is valuable and will be adapted into `DeckSlotManager.getAllocations()` (see section C). The original code stays as a reference.
*   **[GATE] [CardCraftingSystem.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/CardCraftingSystem.js):**
    *   Gate entirely behind `!USE_DECK_LOOP`. The separate `library.tasks` discovery tracker and `discoveredCache` Set are retired.
    *   Discovery is now implicit: if `collection.playsets[templateId] >= 1`, the card is discovered (see section H).
*   **[GATE] `cards.active` / `cards.library` arrays in [GameState.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/GameState.js):**
    *   Behind `!USE_DECK_LOOP`, the old `cards.active` array (loose cards on the board) and `cards.library` array are no longer populated. The new system uses `collection.playsets` + per-area `deckSlots` exclusively.

#### B. Collection State Model (Adapt Existing `playsets`)

The existing `collection.playsets` in [StateSchema.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/StateSchema.js#L242-L253) is already the right shape: `{ [templateId]: count }`, validated to be 0-4 per card. It becomes the **single source of truth** for card ownership.

*   **[KEEP] `collection.playsets`:**
    *   `{ [templateId]: ownedCount }` — how many copies the player owns (max 4).
    *   Already validated in `StateSchema.validateSaveData()`.
*   **[KEEP] `collection.unlockedAreaSets`:**
    *   Array of area IDs the player has unlocked. Determines which cards appear in the pack pool.
*   **[KEEP] `collection.packsBought`, `collection.globalPacksBought`:**
    *   Pack cost scaling data. Preserved as-is.
*   **[NEW] Allocation tracking (computed, not persisted):**
    *   To know how many copies of a card are "available" (not slotted into any area deck), we scan all area `deckSlots` at runtime — same approach as the old `reconcileLocation()`.
    *   `DeckSlotManager.getAllocations(templateId)` returns: `{ owned: 3, slotted: [{ areaId: 'area_oak_forest', slotIndex: 2 }, { areaId: 'area_farmland', slotIndex: 0 }], available: 1 }`.
    *   This is a **computed view** (not stored in state), rebuilt on demand when the Binder opens or a slot changes.
*   **[REMOVE] `collection.discoveredItems`, `collection.discoveredEnemies`:**
    *   These remain for items and enemies, but card discovery is now derived from `playsets` (see section H).

#### C. DeckSlotManager (New — Replaces LibraryManager for Card Movement)

*   **[NEW] `DeckSlotManager.js`:**
    *   **Core API:**
        *   `slotCard(areaId, slotIndex, templateId)`:
            1.  Check `collection.playsets[templateId] >= 1` (player owns at least one copy).
            2.  Check available copies: `owned - countSlottedAcrossAllAreas > 0`.
            3.  Check slot compatibility: if the slot has `specializedTags`, the card must match one of them.
            4.  Check **Single-Copy Rule**: `templateId` is not already in another slot of this area's deck.
            5.  If the slot already has a card → auto-unslot the existing card first.
            6.  Set `areaState.deckSlots[slotIndex].templateId = templateId`.
            7.  Reset area loop (index → 0, timer → 0) since deck contents changed.
            8.  Publish `area:deck_updated` event.
        *   `unslotCard(areaId, slotIndex)`:
            1.  Clear `deckSlots[slotIndex].templateId = null`.
            2.  Reset area loop.
            3.  Publish `area:deck_updated` event.
        *   `swapSlots(areaId, fromIndex, toIndex)`:
            1.  Swap `deckSlots[fromIndex].templateId` ↔ `deckSlots[toIndex].templateId`.
            2.  Validate both cards are compatible with their new slots (specialized tag check).
            3.  If incompatible → reject the swap with an error message.
            4.  Reset area loop.
        *   `moveCardBetweenAreas(fromAreaId, fromSlotIndex, toAreaId, toSlotIndex)`:
            1.  Unslot from source area, slot into target area.
            2.  Uses the same validation as `slotCard`.
            3.  Both areas' loops reset.
    *   **Query API:**
        *   `getAllocations(templateId)` — returns `{ owned, slotted: [{areaId, slotIndex}], available }` by scanning all area `deckSlots`.
        *   `getAvailableCardsForSlot(areaId, slotIndex)` — returns all `templateId`s from `collection.playsets` that: (a) have available copies, (b) aren't already in this area's deck, (c) match the slot's specialized tags. Used by the Binder to show what can go into a selected slot.
        *   `getAreaDeckContents(areaId)` — returns the full deck slot array with resolved template data for UI display.

#### D. Collection Binder UI (Reworked CardLibraryModal)

The existing [CardLibraryModal.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/CardLibraryModal.jsx) is a robust 3-column modal with search, filters, and a preview gutter. It will be **adapted** (not rewritten from scratch) into the new Collection Binder.

*   **[MODIFY] [CardLibraryModal.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/CardLibraryModal.jsx) → `CollectionBinderModal.jsx`:**
    *   **Layout change: List → Grid.**
        *   The old catalog (Column 2) renders `LibraryCardBar` list items. Replace with a **card grid** layout — cards displayed as small card faces in a grid, like pages in a physical binder.
        *   Grid dimensions: ~4-6 cards per row depending on modal width. Each card shows its icon/art, name, and a small ownership pip indicator (e.g., 3/4 dots filled).
    *   **Tabs replace area-set grouping:**
        *   Top-level tabs for card categories: **All**, **Task**, **Combat**, **Station**, **Consumable**.
        *   Within each tab, cards can be sorted by: **Name**, **Area** (which pack it drops from), **Skill**, **Level**.
        *   The existing `LibraryTabNavigation` component (Cards/Items/Enemies tabs) is preserved for cross-entity browsing.
    *   **Per-card actions (replacing Withdraw/Reclaim):**
        *   Each card in the grid shows a small **status indicator**: available copies count, and which areas it's slotted into (via `DeckSlotManager.getAllocations()`).
        *   **"Add to Deck" button:** Opens a dropdown/submenu showing all areas with compatible empty slots. Selecting an area calls `DeckSlotManager.slotCard()`.
        *   **"Remove from Deck" button:** Shows if the card is slotted somewhere. Lists the area(s) it's in. Selecting one calls `DeckSlotManager.unslotCard()`.
        *   If the card has 0 available copies (all 4 slotted), the Add button is disabled and the card shows a "Fully Deployed" badge.
    *   **Preview Gutter (Column 3):**
        *   [LibraryCardPreviewGutter.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/LibraryCardPreviewGutter.jsx) is preserved. It already shows inputs, outputs, stats, and background art for the selected card.
        *   **New addition:** Below the card preview, show a **Deployment Map** — a small list showing where each owned copy is deployed (e.g., "Copy 1: Oak Forest Slot 3", "Copy 2: Available").
    *   **Filter sidebar (Column 1):**
        *   [LibraryFilters.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/LibraryFilters.jsx) is preserved. The existing type, skill, sub-skill, area, status, and level filters already cover most needs.
        *   **New filter:** "Deployment status" — All / Available / Fully Deployed / Not Owned (replaces the old Playmat/Storage filter).

#### E. Drag-and-Drop Integration

*   **Binder → Area Deck Slot:**
    *   Cards in the Binder grid are **draggable**. Each card carries its `templateId` as drag data.
    *   Area Deck slots in the `AreaBannerRow` Deck Focus view are **drop targets**. When a card is dropped onto a slot:
        1.  Validate via `DeckSlotManager.slotCard()`.
        2.  If valid → card appears in the slot, loop resets. The Binder's pip display updates to reflect one fewer available copy.
        3.  If invalid (wrong slot type, no copies available, already in this deck) → show a brief error tooltip explaining why.
*   **Area Deck Slot → Binder (or trash):**
    *   Cards in an area's Deck Focus view are draggable back out. Dropping them outside a valid slot calls `DeckSlotManager.unslotCard()`, returning the copy to the available pool.
*   **Implementation note:** The drag-and-drop can be built with HTML5 drag events or a library like `@dnd-kit`. The choice is deferred to implementation time.

#### F. Pack Shop (Reworked Buy Flow)

Packs no longer exist as physical cards on a board. The purchase flow is streamlined into a direct UI interaction.

*   **[MODIFY] [TopBarView.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/TopBarView.jsx):**
    *   Add a **"Buy Pack"** button showing the current pack cost (gold icon + amount).
    *   Button is **disabled** with a "Sold Out" label when `checkAreaExhaustion()` returns true.
    *   Clicking the button calls the new `openPack()` flow (see below).
*   **[NEW] `PackRevealModal.jsx`:**
    *   A modal/panel that appears when the player buys a pack.
    *   Shows **4 card options** generated by `CollectionManager.generatePackOptions()`.
    *   Each option is rendered as a full card face (using the existing card rendering pipeline).
    *   The player **clicks a card to claim it**. The selected card is added to `collection.playsets` (ownership count +1).
    *   After claiming, the modal can either close or show a brief "Added to Collection!" confirmation with an animation.
    *   **No multi-select** — player picks one card per pack purchase (aligning with the existing `generatePackOptions` which creates 4 options to choose from).
*   **[MODIFY] [CollectionManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/CollectionManager.js):**
    *   **`buyPack()`** is simplified:
        1.  Check gold and exhaustion.
        2.  Deduct gold via `CurrencyManager.spendGold()`.
        3.  Increment `globalPacksBought`.
        4.  Return the 4 options from `generatePackOptions()` — **do not spawn any card onto a board**.
        5.  The UI handles the selection. When the player picks a card, call the new `claimToCollection(templateId)`.
    *   **`claimToCollection(templateId)`** *(NEW — replaces old `claimCard`)*:
        1.  Increment `collection.playsets[templateId]` by 1.
        2.  Publish `collection_updated` event.
        3.  No `CardManager.createCard()` call — no card instance is spawned. The collection count is the only state change.
    *   **`claimCard()`** is gated behind `!USE_DECK_LOOP` (it spawns physical card instances, which the new system doesn't do).

#### G. Pack Pool & Cap Logic (Adapt Existing)

The existing [CollectionManager](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/CollectionManager.js) already has most of the pool and cap logic. It needs minor adjustments:

*   **[KEEP] `generatePackOptions()`:**
    *   Already pools cards from all unlocked area sets and checks `playsets[cardId] < maxCount`. This is exactly the right behavior.
    *   **Minor change:** Station cards should also appear in the pool. Ensure `areaSet.deckList` includes station card IDs (handled by the Phase 4B area set registry update).
*   **[KEEP] `checkAreaExhaustion()`:**
    *   Already checks if all cards in all unlocked areas are fully collected. Used to trigger the "Sold Out" state.
*   **[KEEP] `getPackCost()`:**
    *   Cost scaling based on `globalPacksBought`. No changes needed.
*   **[MODIFY] Quest handling in pack options:**
    *   Currently, quest cards can appear in pack options and get spawned as board cards. In the new system, quest handling is TBD — quests may become area encounters rather than collectible cards. For now, **exclude quests from the unified pack pool** and focus on task, combat, and station cards.

#### H. Discovery Simplification

*   **Old system:** Three separate trackers — `CardCraftingSystem.discoveredCache`, `collection.playsets`, and `collection.discoveredItems/discoveredEnemies`.
*   **New system:** Card discovery is **implicit from ownership**.
    *   `isCardDiscovered(templateId)` → `return (collection.playsets[templateId] || 0) >= 1`
    *   No separate discovery tracker, no `library.tasks` array.
*   **[MODIFY] Binder display:**
    *   Cards with `playsets[templateId] === 0` appear as **silhouettes** in the grid (name visible but art dimmed, showing the player what cards exist but aren't owned yet).
    *   Cards with `playsets[templateId] >= 1` appear with full art and an ownership count badge.
*   **Items and Enemies:** `collection.discoveredItems` and `collection.discoveredEnemies` are **preserved** — items and enemies are still discovered through gameplay encounters, not through pack purchases. Only *card* discovery is simplified.
*   **[MODIFY] [CardLibraryModal.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/CardLibraryModal.jsx) (now `CollectionBinderModal.jsx`):**
    *   Replace `LibraryManager.isDiscovered()` calls with the new `(playsets[id] || 0) >= 1` check.
    *   Replace `LibraryManager.reconcileLocation()` calls with `DeckSlotManager.getAllocations()`.

#### ✅ Smoke Test
*   **Pack purchase:** Click "Buy Pack" on the TopBar. Verify gold is deducted and 4 card options appear. Select one → verify `collection.playsets` increments and the card appears in the Binder with full art.
*   **Binder grid:** Open Binder. Verify cards display in a grid layout. Switch tabs (All / Task / Combat / Station). Sort by name, area, skill. Filter by deployment status.
*   **Slot via button:** In the Binder, click "Add to Deck" on a card → select an area → verify the card appears in that area's deck slot. Click "Remove from Deck" → verify it returns to available.
*   **Slot via drag:** Drag a card from the Binder grid onto an area deck slot in Deck Focus view. Verify it slots correctly. Drag it back out → verify it unslots.
*   **Single-Copy Rule:** Try to slot the same card twice in one area's deck → verify rejection with error tooltip.
*   **Cap at 4:** Buy packs until a card reaches 4 copies → verify it stops appearing in pack options. Buy packs until all unlocked cards reach 4 → verify "Sold Out" state on the TopBar button.
*   **Legacy gate:** Toggle `USE_DECK_LOOP = false` → verify old library modal and pack board cards still work.

---

### Phase 6: Frontend Layout & UI (Area Rows & Banners)

Building the visual interface of the Area Rows. This phase applies the performance-aware rendering patterns that prevent 12 banner rows from overwhelming React.

*   **[NEW] Area Banner Row (`AreaBannerRow.jsx`):**
    *   Build Static Pillars: Control Panel (0.5s), Info Panel (1.0s), Hero Slot (1.0s), Station Slot (1.0s).
    *   Build Flexible Center (4.0s).
    *   Reuses the preserved **card rendering pipeline** (card-modules, ActiveCardFace, sprites, progress bars) for the Active Card display.
    *   Each `AreaBannerRow` subscribes **only to its own area's events** (using the `area:<event>` convention from Phase 2F). It ignores events from other areas entirely.
*   **[NEW] Sliding Barrier Transition:**
    *   Implement CSS/Framer Motion animations to slide the split barrier of the banner vertically/diagonally (transitioning 80/20 widths).
*   **[NEW] Inline Focus Views:**
    *   Deck Focus: horizontal scrolling list of slotted cards.
    *   Equip Focus: inline gear slots and stats panel.
    *   Recipe Focus: horizontal scroll selector of craftable outcomes.
    *   Upgrade Focus: building requirements panel.
    *   Dimming: fade non-focused rows when focus state is active.
*   **[MODIFY] [ReactRoot.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/ReactRoot.jsx):**
    *   When `USE_DECK_LOOP = true`, render `AreaBannerContainer` (which renders one `AreaBannerRow` per unlocked area) in the center content area instead of `CardView`.
    *   Existing sidebars (`HeroView`, `InvView`) **remain visible** at this point — they still serve as the primary way to manage heroes and inventory until the Bottom Drawer replaces them.

#### D. Ref-Based Progress Bar Updates *(PERF)*

> [!IMPORTANT]
> **Optimization Rule:** Progress bars are the single most frequently updated visual element in the game (potentially 12 bars updating 10 times per second = 120 updates/sec). They must **bypass React's state system entirely** and update the DOM directly.

*   **Implementation:** Each `ActiveCardProgressBar` component receives a `ref` and subscribes to a lightweight `area:progress` event. On each event, it directly sets `ref.current.style.width` — no `setState`, no React reconciliation, no virtual DOM diffing.
    ```jsx
    // Conceptual pattern:
    const barRef = useRef();
    useEffect(() => {
        const unsub = EventBus.subscribe('area:progress', (data) => {
            if (data.areaId !== myAreaId) return;
            barRef.current.style.width = data.percent + '%';
        });
        return unsub;
    }, [myAreaId]);
    ```
*   **React state is only used for structural changes** — when a card transitions (new card name, new icon, new description), React re-renders normally. The *progress animation* within a card's execution is purely DOM-driven.

#### E. Collapsed Row Optimization *(PERF)*

*   When the player clicks "Hide" on an Area Banner, the row collapses to a thin summary strip.
*   **Collapsed rows unmount their internal card slot components entirely.** No active card rendering, no progress bar refs, no event subscriptions for progress. They keep only a minimal status indicator (area name, hero portrait, running/paused icon).
*   This means a player with 12 areas but only 4 expanded rows is only rendering 4 full banners — the other 8 cost essentially nothing.

#### ✅ Smoke Test
*   All unlocked areas render as horizontal banner rows. Active card shows real-time progress. Clicking the deck button opens Deck Focus. Clicking the hero slot opens Equip Focus. Sidebars still work for hero/inventory management.
*   **Perf check:** With 8+ areas visible, progress bars animate smoothly at 60fps. Collapsing a row stops its progress bar updates immediately. React DevTools Profiler shows no unnecessary re-renders in non-focused area rows when one area completes a card.

---

### Phase 7: Bottom Folder Drawer UI & Sidebar Retirement

Implementing the folder drawer at the bottom of the screen. **This is when the existing sidebars are retired.**

*   **[NEW] Bottom Folder Drawer (`BottomFolderDrawer.jsx`):**
    *   Three-pane layout: Left (Inspection Panel), Center (Main View), Top (Search & Filter bar).
    *   Implement folder tabs: Heroes, Cards, Stations, Bank.
*   **[NEW] Contextual Drag-and-Drop Hooks:**
    *   Support dragging Heroes → Hero Slot, Cards → Deck Slots, Stations → Station Slot, Items → Gear/Deck.
*   **[NEW] Ergonomic Auto-Open & Auto-Filter:**
    *   Trigger auto-expansion and pre-filtering of the drawer when an empty row slot is clicked.

#### Sidebar & Modal Retirement *(NEW)*
*   **[REMOVE] Left Sidebar:** `HeroView.jsx` — functionality moves to the Heroes tab in the Bottom Drawer.
*   **[REMOVE] Right Sidebar:** `InvView.jsx` — functionality moves to the Bank tab in the Bottom Drawer.
*   **[REMOVE] Tavern Drawer:** `TavernDrawer.jsx` — recruitment moves to a tab or sub-view in the Bottom Drawer.
*   **[REVIEW] Existing Modals:** Evaluate each for retirement or integration:
    *   `SettingsModal` → **Keeps** (global settings, always needed).
    *   `CardLibraryModal` → **Retires** (replaced by Cards tab in Bottom Drawer).
    *   `CollectionModal` → **Retires** (replaced by Cards tab collection view).
    *   `SpawnEntityModal` → **Keeps** (dev/debug tool).
    *   `SlotSelectionModal` → **Keeps** (save slot picker).
    *   `BonusModal` → **Keeps** (project bonuses summary).
    *   `HeroCustomizeModal` → **Retires** (replaced by Hero Inspection in Bottom Drawer).
*   **[MODIFY] `useUIModals` hook:** Remove retired modal state. Add Focus View state tracking (`activeFocusAreaId`, `focusMode`).

#### ✅ Smoke Test
*   Bottom Drawer opens with all four tabs. Dragging a hero from the Heroes tab onto an Area Banner's Hero Slot assigns them. Clicking an empty deck slot auto-opens the Cards tab with appropriate filters. Old sidebars are gone — all their functionality is accessible through the drawer.

---

### Phase 8: Time Bank (Offline Fast-Forward) *(REVISED — scope pivot 2026-07-08)*

> [!NOTE]
> **Scope pivot (owner decision 2026-07-08).** The original plan for this phase was an **Offline Progress Simulator** — a math-only fast-forward that projects what each deck loop *would have* produced while the game was closed. That is **deferred**, not built: accurately simulating offline progression is hard, and the game's systems aren't finalized yet, so we'd be modelling a moving target. Instead we build a **Time Bank**: offline time is banked and later "played out" by **accelerating the live engine**. Because it's the real engine running faster, combat, crafting, RNG, and every timer just work — there is no separate simulation to keep in sync. See Appendix A-1 for the full decision. The Balance Tester bullet is deferred alongside the simulator.

**This pass is the "essentials" only** (owner: build the bones, revisit later for high multipliers and polished UI).

*   **[NEW] Time Bank accrual (closed-only):** on save load, add `now − savedAt` to `state.time.timeBankMs`, capped at `TIME_BANK.MAX_MS` (24h). `savedAt` (already stamped on every save) is forwarded on the `game_loaded` event; `TimeBankManager.accrueOffline()` consumes it. Time past the cap is discarded (standard idle "come back within a day" contract).
*   **[NEW] Fast-forward spending:** `TimeBankManager.startSpending(N)` sets `TimeManager.setTimeScale(N)` (approach #1 — no separate sim). A per-tick drain (`time_bank` tick handler, gated behind `USE_DECK_LOOP`) subtracts the game-time advanced from the bank; when it empties, snap back to 1x. Presets: `TIME_BANK.PRESETS = [2, 5, 10]`.
    *   **Why 10x cap:** every loop/draw/shuffle duration is ≥1s, so at the engine's 10 ticks/s a ≤10x time-scale still yields ≥1 tick per action and stays correct **without** raising tick frequency. True 100x requires either a higher tick rate or a per-tick catch-up loop (the engine currently does at most one action per area per tick) — **deferred** as the later optimization.
    *   **Drain/accounting model (owner-confirmed, approximate):** the bank holds game-time to replay; it drains by the full game-time advanced each tick (`realDelta × N`). A full 24h bank plays out in ~24h/N real time (~2.4h at 10x).
*   **[NEW] Minimal UI:** `hud/TimeBankWidget.jsx` on the TopBar (flag-on) — banked-time readout, preset buttons (disabled when empty), and a Stop control while spending. Event-driven via `time_bank_updated`.
*   **[DEFERRED] Offline Progress Simulator** (math-only projection) and **Balance Tester** — revisit once the game's systems are more finalized. The Time Bank sidesteps the need for offline simulation in the meantime.

#### ✅ Smoke Test
*   Load a save that was written a while ago → the bank shows the elapsed offline time (capped at 24h).
*   Pick a preset (e.g. 10x) → the game visibly runs faster and the bank counts down; the bank drains ≈ the game-time advanced. When the bank empties, speed returns to 1x automatically. Stop returns to 1x manually.
*   Flag-off: no Time Bank UI, game boots and plays unchanged.

---

### Phase 9: Legacy Cleanup Sweep *(NEW)*

> [!WARNING]
> **This phase happens LAST — only after everything above is working and tested with `USE_DECK_LOOP = true`.**

*   **[DELETE] Feature flag:** Remove `USE_DECK_LOOP` and all `!USE_DECK_LOOP` gated code paths. The new system is now the only system.
*   **[DELETE] Grid files:** `StaticGridLayer.jsx`, `GridCell.jsx`, `SlotHUDLayer.jsx`, `PlaymatViewport.jsx`, `PlaymatBackground.jsx`, `HitSurfaceLayer.jsx`.
*   **[DELETE] Old board component:** `CardView.jsx` (the 24KB playmat renderer), `DeckCardView.jsx`.
*   **[DELETE] Old card management:** `DeckSystem.js`, `LibraryManager.js`, `CardStackManager.js`.
*   **[DELETE] Old state:** Remove `grid` from `StateSchema.js`, remove `cards.active` / `cards.library`, remove `getCardAt()` / `getValidAdjacentEmptyCells()` from `GameState.js`.
*   **[DELETE] Old sidebar components:** `HeroView.jsx`, `InvView.jsx`, `TavernDrawer.jsx`.
*   **[DELETE] Retired modals:** `CardLibraryModal.jsx`, `CollectionModal.jsx`, `HeroCustomizeModal.jsx`.
*   **[CLEAN] Layout constants:** Remove gated spatial variables from `layoutConstants.js`.
*   **[CLEAN] `CoordinateUtils.js`:** Remove any 2D coordinate logic that was not repurposed.

#### ✅ Smoke Test
*   Full playthrough. New game → buy packs → assign heroes → configure decks → run loops → craft at stations → go offline → return. No references to grid, spatial, or old card systems remain in the codebase.

---

## Appendix A: Explicitly Deferred Features

These features are described in the concept document but are **intentionally out of scope** for this rework. They will be added in future passes once the core deck loop is stable.

| Feature | Concept Section | Reason for Deferral |
|---|---|---|
| Status Effects / Buff Engine | §9 (Loop Buffs, Salt Shield, etc.) | Significant new system; core loop must work first |
| Area Skill Trees | §5 | Explicitly marked "Future Implementation" in concept |
| Chaos / Threat / Invasion re-integration | §Appendix C | Old event spawning is muted; needs full redesign for 1D loop |
| Slot Injection cards (Tavern, Decoy Trap) | §Appendix B.1 | Requires dynamic deck mutation during loop execution |
| Negative card injection (Sprained Ankle) | §Appendix C.3 | Same — requires runtime deck manipulation |
| Hazard Slot **mitigation** (Skill Tree nodes that weaken/remove hazards) | §5, §Appendix C.1 | Tied to Area Skill Trees. **Note: the hazard slots themselves are NOT deferred** — see §2C-1/§3I. Only the mitigation mechanic waits on skill trees. |
| Offline Progress **Simulator** (math-only projection of loops while closed) + Balance Tester | Phase 8 (original) | Replaced this pass by the **Time Bank** (accelerate the live engine instead of simulating it). Revisit once the game's systems are finalized enough to be worth simulating. |

---

## Appendix A-1: Gap-Analysis Decisions Log *(NEW — this revision)*

This addendum records the specific gaps found when auditing v3 against the current codebase, and the decisions made to close them. Recorded here (rather than only inline) so a future agent picking up mid-implementation has one place to check "why does the roadmap say X" without re-deriving it.

| Gap Found | Decision | Where Addressed |
|---|---|---|
| Uncommitted diff mid-flight on an unrelated 2D-grid consolidation, touching files Phase 1 plans to gate | **Abandon it** — discard before Phase 0 begins. The whole grid system it improves is deleted in Phase 9 anyway. | Phase 0, §-1 |
| Save migration pipeline (`SaveMigration.js`) is an empty stub; new schema is incompatible with old saves | **Breaking change, no migration.** Old saves refuse to load with a message to start fresh. Acceptable pre-launch/alpha. | Phase 0, §A |
| LoopRunner's generic countdown-timer tick model doesn't fit existing multi-round, RNG-based combat (`CombatTickProcessor.js`) | **Hand-off model.** LoopRunner pauses the area and delegates entirely to the existing unmodified `CombatSystem`; resumes the loop on resolution. No combat internals are rebuilt. | Phase 3, §I |
| Hazard slots (concept doc §3D/Appendix C.1) have zero existing implementation | **In scope now, mitigation deferred.** Basic damage-per-pass hazard slots ship in this rework; only Skill Tree mitigation nodes wait for the future pass. Reuses the combat hand-off's HP-check/defeat routing. | Phase 2, §C-1; Phase 3, §I |
| Quest tracking has three divergent paths (legacy global, board quest cards, area-unlock progress) and the roadmap didn't address consolidation | **Quest cards only exist on locked Areas as the unlock requirement** — never slotted into a running deck loop. Consolidate down to the area-unlock progress path; retire the board-card and (likely) legacy-global paths. | Phase 2, §G |
| CMS `AreaEditor.jsx` has no tooling for authoring `deckSlots`/`specializedTags`/hazard config/station data — Phase 2B was schema-only | **New CMS editor work budgeted explicitly**, not assumed to fall out of the schema change. Deck Slot Editor panel + station authoring in the card editor. | Phase 2, §H |
| *(Phase 3 implementation, decided with owner 2026-07-07:)* The preserved execution engines (`WorkProcessor`, `StatProcessor`, `CombatProcessor`) all operate on rich card instances, but flyweight deck slots deliberately have none | **Ephemeral card model** (owner-approved). When a slot activates, one temporary card is built from the template via `CardFactory.createInstance()`, held in a runtime-only map in `LoopRunner`, and discarded on completion. Never in `cards.active`, never saved; at most one per area, so the flyweight rule holds. | Phase 3, §A; `LoopRunner._materializeCard()` |
| §3D framed the energy draw cost as an "existing system tweaked", but energy today is only spent on combat attacks — no per-task cost exists and no card has an authored `energyCost` | **Single global constant** (owner-approved): `ENERGY_DRAW_COST = 2` in `loopConstants.js`, paid on every card draw (hazards/empty slots free). Per-card costs can layer on later if balancing demands it. | Phase 3, §D |
| Task cards can randomly morph into ambush fights via `combat_trigger` drop entries + `transformToCombat` — the roadmap never addressed this, and there is no board card to transform under the loop | **Ambushes dropped flag-on** (owner-approved): combat happens only at combat card slots, preserving the deterministic/walk-away-safe loop. A rolled trigger yields no loot that cycle. Flagged as a possible future re-addition. | Phase 3; gate in `WorkProcessor.completeWorkCycle` |
| §3F gave no numbers for the death penalties | **Placeholders, owner-approved for later tuning:** 25% of each slotted consumable's banked stack destroyed; 10% permanent loss chance per equipped gear piece (food/drink slots exempt). All in `loopConstants.js` (`DEFEAT_PENALTY`). | Phase 3, §F |
| §3I said combat "ticks independently, exactly as it does today" and cited `systems/combat/CombatSystem.js`/`CombatTickProcessor.js` — but that pair is **dormant** (nothing ticks it). The live combat is `cards/logic/CombatProcessor.js`, driven by the same `card_system` tick that is OFF flag-on | **Hand-off targets the live engine:** `LoopRunner` forwards each tick to `cards/logic/CombatProcessor.processCombat` while an area is `in_combat`. The hand-off *concept* is unchanged. The dormant `systems/combat` tick/attack/resolution trio is flagged for the Phase 9 cleanup sweep. | Phase 3, §I; `LoopRunner._tickCombat()` |
| §3G's `StatProcessor.recalculateAreaStats(areaId)` assumed per-slot card instances to walk — flag-on, none exist | **Dirty-flag recalculation lives in `LoopRunner.tick()`:** the single ephemeral active card is the only stat carrier, so the area-scoped recalc collapses to one `recalculateCardStats()` call on it. (Also avoids a StatProcessor→LoopRunner import cycle.) | Phase 3, §G |
| *(Phase 4 implementation, decided with owner 2026-07-08:)* §4G says buffs register on "the area's ModifierAggregator" — but aggregators only existed on cards and heroes; and no authored station has a `passiveBuff` (Water Tower is a "future" example) | **Build the plumbing now with a throwaway test card** (owner-approved). New runtime-only per-area aggregator registry (`AreaModifiers.js`), multiplied into workcycle stats by `StatProcessor`; rebuilt from state on load (`StationSlotManager.rehydrateBuffs()`), same pattern as the ephemeral cards. Test card `station_test_water_tower` (+50% speed, excluded from pack pools via `areaId: null`) exercises it until real buff stations exist. | Phase 4, §G; `src/systems/loop/AreaModifiers.js` |
| §2B's per-area default `stationCardId` was never authored, and stations only become obtainable via packs in Phase 5 — flag-on there is no legitimate way to own one during Phase 4 | **No default stations** (owner decision): areas start with an empty Station Slot; stations arrive only through Phase 5 packs. Phase 4 testing grants copies via the dev console. | Phase 4, §D |
| §4B listed 3 files referencing the `'workstation'` string; the real footprint was ~25 files across src, tests, and the CMS (store keys, editors, generators, file wiring) — and the CMS autosaves drafts to localStorage under the old key | **Full rename anyway** (owner decision), including CMS internals, with a zustand-persist `version: 2` migration that moves `workstations` → `stations` in saved drafts so no authored data is lost. Old workspace backups still hydrate via a `data.stations \|\| data.workstations` fallback. Card ids also renamed (`workstation_*` → `station_*`) — nothing referenced them yet. | Phase 4, §B; `useEntityStore.js` persist config |
| §4H didn't say what happens if the player toggles to Stationed Mode mid-combat | **Refused with a notification** (implementation decision, flagged for owner review): allowing it would let players dodge a losing fight for free, which is exactly what the §3F Forced Retreat penalty prices. Revisit if a deliberate "flee" mechanic is wanted later. | Phase 4, §H; `ModeManager._toStationed()` |
| *(Phase 5 implementation, 2026-07-08:)* §5G claimed `generatePackOptions` "already pools cards from all unlocked area sets" and that `getPackCost`/`globalPacksBought` needed no changes — none of that existed; everything was per-area | **New unified backend built** alongside the (gated) legacy one: `buyUnifiedPack`/`claimToCollection`/`getUnifiedPool`, `collection.globalPacksBought` added to the schema, and a global placeholder cost curve (`UNIFIED_PACK` in `loopConstants.js`: 50g base + 10g/pack, awaiting owner tuning like the defeat penalties). | Phase 5, §F/§G; `CollectionManager` |
| Authored default decks (Phase 2) pre-slot cards, but nothing granted them into `collection.playsets` — the Binder's "owned − slotted = available" math would go negative | **Default decks are starter kit, not a loan:** ownership is granted the moment an area's deck slots are built (`grantDefaultDeckOwnership` in `AreaStateManager`), with a load-time `DeckSlotManager.reconcileOwnership()` covering pre-Phase-5 saves. | Phase 5, §B |
| §5E's drag-and-drop needs deck-slot drop targets, but the Deck Focus view doesn't exist until Phase 6 | **Deferred to Phase 6** (forced sequencing): the Binder's Add/Remove buttons + Deployment Map cover every §5E flow meanwhile; `swapSlots`/`moveCardBetweenAreas` are already in `DeckSlotManager` waiting for the drag layer. | Phase 5, §E; Phase 6 |
| §3E's consumable logic (Phase 3) shipped with zero consumable card templates to exercise it | **First consumable cards authored in Phase 5** (`data/cards/consumable/consumables.json`, Blueberry/Blackberry Pie bound to existing restorative items, new CONSUMABLE preset + registry folder mapping). Excluded from legacy-mode pools so flag-off packs are unchanged. §3E verified live for the first time. | Phase 5; `data/cards/consumable/` |
| *(Phase 6 implementation, 2026-07-08:)* Rows need structural re-renders on loop transitions, but the engine had no event for "the status changed" (only completion/deck/mode events — e.g. drawing→running fired nothing) | **New `area:status_changed` event**, queued (deduped per area per tick) at every LoopRunner/StationManager status transition. Rows are purely event-driven with §2F payload filtering — no polling. | Phase 6; `areaEvents.js`, `LoopRunner`, `StationManager._setStatus` |
| §6 says the Active Card cell "reuses the card rendering pipeline" — but a full `ActiveCardFace` makes each row ~3× taller than the concept's slim banner | **Compact placard in the row** (name, action label, ref-progress bar, status-specific variants for hazard/consumable/combat); the full card face still renders pack reveals and remains available if the owner wants big card art in rows. Flagged for owner review. | Phase 6; `ActiveCardCell` |
| Hero assignment needed a UI, but the drag source (Bottom Drawer) is Phase 7 and the old sidebar's drag targets the retired grid | **Inline Hero Picker** on the banner's Hero Slot (click → list → assign, auto-swap handled by `HeroAssignmentManager`). Drawer drag-and-drop still lands in Phase 7 as planned. | Phase 6; `HeroPicker` |
| `EquipmentGrid.jsx` (hero equipment component) turned out to be dead code — its `SLOT_INFO` import never existed anywhere, so it could never have rendered | **Left dead, marked for Phase 9**; Equip Focus renders its own gear grid (click-unequip + equip-from-bank via `EquipmentManager`). Also fixed its broken innards in place so it at least parses. | Phase 6; `BannerFocusViews.EquipFocusView` |
| *(Phase 8 scope pivot, owner decision 2026-07-08:)* the planned math-only Offline Progress Simulator is complex and premature — you'd be simulating game systems that aren't finalized yet | **Deferred the simulator; built a Time Bank instead.** Offline time is banked (24h cap) and spent by accelerating the LIVE engine (`TimeManager.setTimeScale`), so no parallel simulation exists to drift out of sync. Essentials only this pass. Presets cap at 10x (the one-action-per-tick ceiling holds ≤10x since all durations are ≥1s); true 100x needs a higher tick rate or a per-tick catch-up loop — deferred. Drain model: bank drains by game-time advanced (realDelta×N). Combat's internal pacing may not scale under large deltas (pre-existing `CombatProcessor` behavior) — flagged, revisit with combat. | Phase 8; `TimeBankManager.js`, `loopConstants.TIME_BANK`, `hud/TimeBankWidget.jsx` |

---

## Appendix B: Performance Architecture Summary

These six optimization patterns are baked into the roadmap phases above. This appendix serves as a quick-reference for the reasoning behind each.

### Why This Matters

The game loop ticks **10 times per second**. Each tick has a **100ms budget** to process all work. With 12 areas running simultaneously, each containing ~10 deck slots, we're processing ~120 cards per tick. Without the optimizations below, the game would stutter and drop frames well before reaching 12 areas.

### The Six Patterns

| # | Pattern | Phase | Plain-Language Summary |
|---|---------|-------|------------------------|
| 1 | **Area-Scoped Events** | 2F | Instead of shouting "something changed!" to the whole game, whisper to just the area that cares. Prevents 12× cascade recalculations. |
| 2 | **Flyweight Deck Slots** | 2E | Cards in deck slots are lightweight references (just an ID + progress), not full copies of the card's rules. Keeps memory low, comparisons fast. |
| 3 | **Fast-Path Tick Loop** | 3A | 99% of ticks just subtract a number from a timer (costs nothing). The expensive work only happens at the rare moment a card finishes. |
| 4 | **Area-Scoped Dirty Flags** | 3G | When a hero's gear changes, only that area's ~10 cards recalculate — not all 120. |
| 5 | **Event Batch Coalescing** | 3H | When multiple areas finish tasks in the same tick, their events are collected and fired once at the end, not one-by-one. |
| 6 | **Ref-Based Progress Bars** | 6D | Progress bars update by directly nudging pixels in the browser, skipping React's change-detection system entirely. Collapsed/hidden area rows stop updating altogether. |

### When to Apply Each

```
Phase 2 (Data Layer):    Patterns 1, 2 — Define event names and slot shapes
Phase 3 (Engine Layer):  Patterns 3, 4, 5 — Build the tick loop, dirty flags, and batch system
Phase 6 (UI Layer):      Pattern 6 — Build progress bars and collapsed rows correctly
```

> [!TIP]
> None of these add significant development time when built in from the start — they're choices about how to name events, structure data, and write a `for` loop. Retrofitting them later would mean rewriting the LoopRunner, all event subscribers, and all UI components.
