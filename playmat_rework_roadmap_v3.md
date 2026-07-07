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
| 3 — Backend Loop Engine | ⬜ Not Started | Includes new §I (combat hand-off model) |
| 4 — Station Crafting Queue Integration | ⬜ Not Started | |
| 5 — Unified Booster Shop & Card Collection | ⬜ Not Started | |
| 6 — Frontend Layout & UI | ⬜ Not Started | |
| 7 — Bottom Folder Drawer UI & Sidebar Retirement | ⬜ Not Started | |
| 8 — Offline Progress Calibration & Polish | ⬜ Not Started | |
| 9 — Legacy Cleanup Sweep | ⬜ Not Started | Do this LAST only |

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

### Phase 8: Offline Progress Calibration & Polish

Tying the systems together and validating pacing. *(Unchanged from original roadmap.)*

*   **[NEW] Offline Fast-Forward Calculator:**
    *   Calculate accumulated ticks during offline time. Run math-only simulations of the active deck loops (incorporating draw, shuffle, consumption times, and hazard calculations) to reward players upon returning.
*   **[NEW] Balance Tester:**
    *   Run test scripts to simulate loop yields, loop decay rates, and gear-loss frequencies.

#### ✅ Smoke Test
*   Close the game for 10 minutes. Reopen. Verify offline progress report shows correct resources gathered and loops completed.

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
