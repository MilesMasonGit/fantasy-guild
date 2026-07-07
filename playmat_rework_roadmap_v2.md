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

#### A. Version Bump
*   Bump `GAME_VERSION` from `'1.0.0'` to `'0.2.0'` in [StateSchema.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/StateSchema.js) to reflect the alpha milestone shift.

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
*   **Quest Slotting Logic (Repurpose):**
    *   *Adapt:* Quest Cards will be slotted directly into designated slots in the Area Deck, serving as active progression tasks in the loop.

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
    *   Add `deckSlots` structure with `specializedTags`, default `stationCardId`, and starting locked/hazard slots.

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

#### ✅ Smoke Test
*   `USE_DECK_LOOP = false`: Old game still works (old state shape is untouched behind the flag).
*   `USE_DECK_LOOP = true`: Can create a new game with the new state shape. `ensureAreaState` returns the correct new structure. Deck slots contain only `templateId` + runtime fields (no template bloat). No ticking yet — just data.

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

#### ✅ Smoke Test
*   `USE_DECK_LOOP = true`: Assign a hero to an area with a pre-configured deck. Watch the loop advance through cards sequentially, with draw/shuffle pauses. Multiple areas tick independently. Energy gate pauses the loop when depleted. Hero defeat triggers retreat.
*   **Perf check:** Open browser dev tools Performance tab. With 4+ areas ticking simultaneously, each tick should complete in under 5ms. Event log should show batched events firing once per tick, not dozens of individual events.

---

### Phase 4: Station Crafting Queue Integration

Implementing safe processing at the Outpost. *(Unchanged from original roadmap.)*

*   **[NEW] Station Crafting Runner (`StationManager.js`):**
    *   Check queue for active recipes.
    *   Refine logs → planks, ores → bars, etc.
*   **[NEW] Queue Rules Engine:**
    *   Manage production limit counters. Pause recipe when target quantity is reached.
    *   Manage Infinite Mode check; run recipe continuously if inputs are in the bank.
*   **[NEW] Input/Output Pipeline:**
    *   Safely deduct ingredients from inventory bank and deposit finished items upon craft completion.

#### ✅ Smoke Test
*   Switch a hero to Stationed Mode. Assign a Lumber Mill station card. Queue Oak Logs → Oak Planks. Verify items are consumed and produced correctly.

---

### Phase 5: Unified Booster Shop & Card Collection Overhaul

Reworking card collection mechanisms, retiring the old deck/library split, and unifying the gold economy.

#### A. Retire Old Card Management *(NEW)*
*   **[GATE] [DeckSystem.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/DeckSystem.js):** Gate entirely behind `!USE_DECK_LOOP`. No longer opens per-area packs.
*   **[GATE] [LibraryManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/LibraryManager.js):** Gate entirely. Cards no longer move between "active" and "library."
*   **[NEW] `DeckSlotManager.js`:**
    *   `slotCard(areaId, slotIndex, templateId)` — places a card from the collection into an area's deck slot (if the player owns an available copy and the slot accepts that card type).
    *   `unslotCard(areaId, slotIndex)` — removes a card from a deck slot, returning it to the available pool.
    *   `swapSlots(areaId, fromIndex, toIndex)` — swaps two cards within a deck.
    *   Enforces the **Single-Copy Rule**: only 1 copy of a given card per area deck.
    *   Enforces slot type restrictions (tag locks, specialized slots).

#### B. Unified Booster Pack
*   **[MODIFY] [CollectionManager.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/CollectionManager.js):**
    *   Retire separate area packs; implement the **Unified Booster Pack**.
    *   Dynamically expand pack loot tables as new Areas are unlocked.
*   **[NEW] Card Cap Checker:**
    *   Track ownership counts of all action cards.
    *   Once a card reaches 4 copies, remove it from the unified pack drop pool.
*   **[MODIFY] Shop Interface:**
    *   Disable unified pack purchase option and display "Sold Out" state once all unlocked cards are capped at 4 copies.

#### ✅ Smoke Test
*   Buy a unified pack. Verify cards are added to the collection. Slot cards into area decks from the collection. Verify the Single-Copy Rule is enforced. Buy copies until a card caps at 4 — verify it stops appearing in packs.

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
