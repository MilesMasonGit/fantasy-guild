# Roadmap: Playmat to Area Deck Loop System Rework

This roadmap outlines the phases of implementation required to migrate the game from the legacy spatial **2D Playmat System** to the new **1D Area Deck Loop System**.

---

## Broad Phase Overview

```
┌──────────────────────────────────────┐
│  Phase 1: Feature Deprecation        │ ◄── We start here (isolation & cleanup)
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 2: Data Schema & State Rework │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 3: Backend Loop Engine        │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 4: Station Crafting Engine    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 5: Unified Booster Shop       │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 6: Frontend Banner Rows & UI  │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 7: Bottom Folder Drawer UI    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Phase 8: Offline Progress & Polish  │
└──────────────────────────────────────┘
```

---

## Detailed Phases

### Phase 1: Feature Deprecation & Retirement Gating
Before introducing new systems, we must isolate and disable legacy 2D spatial features and card-level attachments, while preserving core drag-and-drop hit-testing logic for repurposing.

#### A. Obsolete Code to Retire (Complete Deletion)
*   **Card Gutter Slots:** Remove all logic relating to dragging Heroes or items *onto* individual task cards (since heroes now attach to the Area, and inputs are consumed implicitly from the bank).
*   **2D Grid Geometry Layer:**
    *   [StaticGridLayer.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/StaticGridLayer.jsx) (Retire 2D mesh tile rendering).
    *   [GridCell.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/GridCell.jsx) (Retire grid cell layout containers).
    *   [SlotHUDLayer.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/SlotHUDLayer.jsx) (Retire spatial cell hovers/overlays).
    *   [PlaymatViewport.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/PlaymatViewport.jsx) (Retire pan/zoom viewport canvas).
*   **Legacy Card View Containers:**
    *   [DeckCardView.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/DeckCardView.jsx) (Retire; legacy card packs, quest decks, and chest containers will not exist as spatial board meshes).

#### B. Code to Repurpose (Modify & Keep)
*   **Coordinate Mapping (`CoordinateUtils.js`):**
    *   *Do NOT delete:* Repurpose this utility to translate 1D linear array indexes (slots `0` through `N`) into horizontal pixel offsets on the active banner row.
*   **Drag-and-Drop Hit-Testing & Resolution (`DndProvider.jsx` & `CardResolver.js`):**
    *   *Retire:* 2D snapping bounds, panning restrictions, card-on-card stacking checks, and spatial adjacency logic.
    *   *Retire:* Card-level gutter target detection.
    *   *Keep & Adapt:* Bounding box hit-testing to detect drops on the Area Banner's slots:
        *   Drops on `X = 0` ➔ Triggers Hero assignment resolver.
        *   Drops on `X = 1..N` ➔ Triggers Deck slot assignment resolver.
        *   Drops on `X = N+1` ➔ Triggers Outpost Station assignment resolver.
    *   *Salvage & Adapt (Card Reordering & Removal):*
        *   **Deck Swapping:** Dragging a card from Slot A and dropping it on occupied Slot B swaps their positions in the deck loop array.
        *   **Deck Removal:** Dragging a card out of a slot and dropping it onto the bottom drawer (or releasing it outside the row bounds) unslots the card, clearing the slot.
*   **Task Execution Core Logic (PRESERVE):**
    *   *Do NOT delete:* [WorkProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/WorkProcessor.js), [RequirementProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/RequirementProcessor.js), and [StatProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/StatProcessor.js).
    *   *Modify:* Redirect Hero lookup in `processWorkCycle` to resolve the hero from the parent Area Banner rather than looking up a card-specific `assignedHeroId`.
    *   *Mute:* Disable tool durability reduction. Task cards will now check if the required tool category is equipped to the Area's assigned Hero rather than deducting points from the tool itself.
*   **Card UI Rendering Subsystem (PRESERVE):**
    *   *Do NOT delete:* [CardView.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/CardView.jsx) and all files in the [card-modules](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/card-modules/) directory.
    *   *Modify:* Strip out card-level gutter slot renders and interactive hero drop overlays from the card frame. Keep full-fidelity sprite rendering, progress bar ticks, headers, and descriptions for rendering inside the Area Banner's active slot.
*   **Combat Logic & Pacing (Repurpose):**
    *   *Retire:* Legacy code handling post-battle timers and spatial encounter pauses.
    *   *Note:* The transition pacing between fights is now handled globally by the `LoopRunner` Draw/Shuffle intermission timers.
*   **Quest Slotting Logic (Repurpose):**
    *   *Adapt:* Instead of separate overlay displays, Quest Cards will be slotted directly into designated slots in the Area Deck, serving as active progression tasks in the loop.

#### C. Systems to Disable/Mute (Keep Source Code)

*   **Chaos, Threat, Invasion, & Event Spawning:**
    *   *Action:* Disable/comment out the event subscribers and managers that attempt to spawn physical cards onto the board grid (e.g., in `EventProcessor.js` and associated managers).
    *   *Note:* Keep all files and core simulation logic intact in the repository so they can be easily re-engineered for the deck loop system in a future version.

#### D. Cleanups & Layout Hooking
*   **Cleanups:**


    *   [layoutConstants.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/layoutConstants.js) (Remove variables like `PLAYMAT_PADDING` and `PLAYMAT_GAP_X`).
    *   [ReactRoot.jsx](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/ReactRoot.jsx) (Clean out sidebars and panners, prepare to host Area Banner Rows).

---

### Phase 2: Core Data Schema & State Rework
Refactoring the JSON registries and defining the new state model for Areas, Decks, and Outposts.

*   **[MODIFY] Area Data Registries:**
    *   [areas.json](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/cards/area/areas.json) (Strip `gridConfig`, `validCells`, and default templates. Add `deckSlots` structure with `specializedTags`, default `stationCardId`, and starting locked slots).
*   **[NEW] State Managers (Redux/Zustand or GameState engine):**
    *   Create state schemas for active Area Decks:
        *   `activeCardIndex` (which card is currently executing).
        *   `executionTimer` (ticks down current card Task Time).
        *   `mode` (`adventure` vs `stationed`).
        *   `status` (e.g. `running`, `paused`, `injured`).
    *   Create state schemas for Outpost Stations:
        *   `activeStationCardId` (slotted building).
        *   `craftingQueue` (array of recipes, quantities, and infinite toggles).

---

### Phase 3: Backend Loop Engine (Adventure Runner)
Building the logic that processes the linear deck loop sequentially in Adventure Mode.

*   **[NEW] Sequential Loop Runner (`LoopRunner.js`):**
    *   Integrates with [WorkProcessor.js](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/WorkProcessor.js) to process the active card slot's execution cycle.
    *   Intercepts task completion; instead of looping the same card, it increments the index (`activeCardIndex = (activeCardIndex + 1) % deckSize`) and triggers the next card draw.
    *   Handles loop wrap-around: last card ➔ shuffle ➔ first card.

*   **[NEW] Loop Pacing Manager:**
    *   Implement **Draw Time** (1-2s delay between card steps).
    *   Implement **Shuffle Time** (5-10s delay between loop resets).
*   **[NEW] Consumable Consumption & Skip Handler:**
    *   Check global bank quantities.
    *   If available: deduct 1 unit from bank, trigger **3-second Consumption Time**, apply status/effect.
    *   If unavailable: skip effect but still trigger **3-second Consumption Time** penalty before proceeding.
*   **[NEW] Defeat & Forced Retreat State Machine:**
    *   Listen to hero combat outcomes.
    *   On HP reaching 0: Pause loop ➔ Toggle mode to `stationed` ➔ Apply `[Injured]` status condition.
    *   Calculate death penalties: deplete active consumable stacks in the loop, check gear breakage chance, and permanently delete equipment assets if triggered.

---

### Phase 4: Station Crafting Queue Integration
Implementing safe processing at the Outpost.

*   **[NEW] Station Crafting Runner (`StationManager.js`):**
    *   Check queue for active recipes.
    *   Refine logs ➔ planks, ores ➔ bars, etc.
*   **[NEW] Queue Rules Engine:**
    *   Manage production limit counters. Pause recipe when target quantity is reached.
    *   Manage Infinite Mode check; run recipe continuously if inputs are in the bank.
*   **[NEW] Input/Output Pipeline:**
    *   Safely deduct ingredients from inventory bank and deposit finished items upon craft completion.

---

### Phase 5: Unified Booster Shop & Capped Pool Engine
Reworking card collection mechanisms and gold economy.

*   **[MODIFY] Collection Manager (`CollectionManager.js`):**
    *   Retire separate area packs; implement the **Unified Booster Pack**.
    *   Dynamically expand pack loot tables as new Areas are unlocked.
*   **[NEW] Card Cap Checker:**
    *   Track ownership counts of all action cards.
    *   Once a card reaches 4 copies, remove it from the unified pack drop pool.
*   **[MODIFY] Shop Interface:**
    *   Disable unified pack purchase option and display "Sold Out" state once all unlocked cards are capped at 4 copies.

---

### Phase 6: Frontend Layout & UI (Area Rows & Banners)
Building the visual interface of the Area Rows.

*   **[NEW] Area Banner Row (`AreaBannerRow.jsx`):**
    *   Build Static Pillars: Control Panel (0.5s), Info Panel (1.0s), Hero Slot (1.0s), Station Slot (1.0s).
    *   Build Flexible Center (4.0s).
*   **[NEW] Sliding Barrier Transition:**
    *   Implement CSS/Framer Motion animations to slide the split barrier of the banner vertically/diagonally (transitioning 80/20 widths).
*   **[NEW] Inline Focus Views:**
    *   Deck Focus: horizontal scrolling list of slotted cards.
    *   Equip Focus: inline gear slots and stats panel.
    *   Recipe Focus: horizontal scroll selector of craftable outcomes.
    *   Upgrade Focus: building requirements panel.
    *   Dimming: fade non-focused rows when focus state is active.

---

### Phase 7: Bottom Folder Drawer UI
Implementing the folder drawer at the bottom of the screen.

*   **[NEW] Bottom Folder Drawer (`BottomFolderDrawer.jsx`):**
    *   Three-pane layout: Left (Inspection Panel), Center (Main View), Top (Search & Filter bar).
    *   Implement folder tabs: Heroes, Cards, Stations, Bank.
*   **[NEW] Contextual Drag-and-Drop Hooks:**
    *   Support dragging Heroes ➔ Hero Slot, Cards ➔ Deck Slots, Stations ➔ Station Slot, Items ➔ Gear/Deck.
*   **[NEW] Ergonomic Auto-Open & Auto-Filter:**
    *   Trigger auto-expansion and pre-filtering of the drawer when an empty row slot is clicked.

---

### Phase 8: Offline Progress Calibration & Polish
Tying the systems together and validating pacing.

*   **[NEW] Offline Fast-Forward Calculator:**
    *   Calculate accumulated ticks during offline time. Run math-only simulations of the active deck loops (incorporating draw, shuffle, consumption times, and hazard calculations) to reward players upon returning.
*   **[NEW] Balance Tester:**
    *   Run test scripts to simulate loop yields, loop decay rates, and gear-loss frequencies.
