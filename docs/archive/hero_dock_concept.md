# Hero Dock & Hand-of-Cards UI Concept Document

## 1. Overview & Core Intent

The **Hero Dock** is a persistent, bottom-anchored UI strip displaying the player's master roster of 8–12 heroes as a clean, flat overlapping horizontal card strip.

This design solves the primary UI challenge of balancing banner management, hero inspection, and item equipping by establishing a **seamless card-pull physical metaphor**:
* **Card-Pull Metaphor**: Unpinned docked hero cards display the top section of the full card (matching the shape and layout of playmat hero cards). Pinning a card pulls it upward out of the hand to reveal its equipment slots and stats grid underneath.
* **Master Roster Anchoring**: All heroes maintain fixed, predictable tab positions at the bottom of the screen at all times.
* **Upward Dragging**: Assigns heroes from the dock to active Banner Decks.
* **Downward Dragging**: Equips items from the Bank/Inventory onto hero cards in the dock.
* **Dual Equipment Transfer**: Supports both click-to-unequip back to Bank and drag-to-transfer between heroes.
* **Strict 2-Card Comparison Mode**: Max 2 hero cards can be pinned open side-by-side at any time.
* **Tactile Spring Physics**: Distance-threshold gesture recognition, pop-out ghost slots, and rubber-band spring recoil on invalid drops.
* **Real-Time Combat & Prep Editing**: Players can freely inspect stats and swap equipment at all times.
* **Responsive "Small Mode"**: Adapts gracefully to compact displays by collapsing headers into icon-only face tabs.

---

## 2. Layout & Z-Layering Hierarchy

The UI uses a strict bottom-up stacking order:

```
+-----------------------------------------------------------------------+
|                            BANNERS AREA                               |
|   [ Banner 1: Playmat ]   [ Banner 2: Playmat ]   [ Banner 3... ]     |
|   (Banners display Compact Hero Cards with bottom-right 'X')          |
+-----------------------------------------------------------------------+
|                       BANK / INVENTORY DRAWER                         |
|  (User toggles freely; opens ABOVE Hero Dock, layered BEHIND dock)    |
+-----------------------------------------------------------------------+
| HERO DOCK (Flat Overlapping Card Strip - z-index: 200)                |
|  [Hero 1]  [Hero 2 (Pinned A)]  [Hero 3 (Pinned B)]  [Hero 4] ...     |
+-----------------------------------------------------------------------+
```

| Layer | Z-Index | Description |
| :--- | :--- | :--- |
| **Pinned Card Pop-up** | `z-index: 300` | Max 2 active pinned hero cards lift up over Bank and Banners (`z-index: 300`). |
| **Hero Dock Strip** | `z-index: 200` | Anchored at the absolute bottom edge of the screen (`z-index: 200`). |
| **Bank Drawer** | `z-index: 100` | Existing drawer; opens vertically *above* the Hero dock, layered behind the dock tabs. |
| **Banners / Playmats**| `z-index: 1` | Main playfield, visible behind open drawers and docks. |

---

## 3. Precise Information Architecture & Card Layouts

```
+-------------------------------------------------------------+
| [ Face Sprite ]  Hero Name (Lv. 12)                         |  <-- TOP HEADER (Docked & Playmat Card Top)
|                  [ Status Pill: Banner 1 ]                  |
+-------------------------------------------------------------+
|  [Eq 1]  [Eq 2]  [Eq 3]   <-- EQUIPMENT GRID (2 Rows of 3)   |  <-- REVEALED WHEN PINNED
|  [Eq 4]  [Eq 5]  [Eq 6]   (32px Item Sprites, image only)   |
+-------------------------------------------------------------+
|  [Stat1] [Stat2] [Stat3]  <-- STATS GRID (5 Rows of 3)      |  <-- REVEALED WHEN PINNED
|  [Stat4] [Stat5] [Stat6]  (15 total attribute slots)        |
|  [Stat7] [Stat8] [Stat9]                                    |
|  [St10]  [St11]  [St12]                                    |
|  [St13]  [St14]  [St15]                                    |
+-------------------------------------------------------------+
```

### State A: Default Unpinned Dock Card (Top Peeking Header)
* **Height & Shape**: ~70px–80px height (matching the header shape of cards on playmats).
* **Left Column**: Face Sprite (32px / 48px pixel art portrait).
* **Right Column (Stacked)**:
  * **Top Line**: Hero Name + Level (e.g., `Gildor (Lv. 14)`).
  * **Bottom Line**: Activity Status Pill (*"Banner 1"*, *"Reserve"*, *"⚔️ Combat"*).

### State B: Pinned Open Card (Pulled Up from Hand)
* **Height**: ~260px–300px total expanded card height.
* **Section 1 (Top Header)**: Identical to the Unpinned Dock Card header, maintaining exact visual continuity.
* **Section 2 (Equipment Grid)**: 6 equipment slots arranged in **2 rows of 3** (32px item sprites, image only). Hovering an item displays standard clean item details.
* **Section 3 (Stats Grid)**: 15 attribute slots arranged in **5 rows of 3**.
* **Strict 2-Card Comparison Limit**: A maximum of **2 hero cards** can be pinned open simultaneously (Hero A vs Hero B). Pinning a 3rd hero card automatically unpins/closes the oldest open card.
* **Global Dismissal**: Clicking anywhere outside the Hero Dock unpins all cards.

### State C: Responsive "Small Mode" Tab
* **Trigger**: Narrow screen widths or window sizes (`width < 1024px`).
* **Layout**: Collapses dock cards into compact **Square Face-Only Tabs** (~48px wide).

---

## 4. Interaction, Drag & Auto-Equip Engine

### 1. Hero Assignment (Dock → Banner)
* Click & drag the Top Header of any Hero Card upward from the Dock onto a Banner Deck slot.
* Banner slot highlights green for valid placement.
* Status pill updates to *"Banner X"*.

### 2. Item Equipping (Bank → Dock Card)
* Drag an item from the Bank drawer downward toward a Hero Card in the dock.
* **Card-Wide Target**: Dropping the item **anywhere** on the Hero card auto-equips it.
* **Auto-Swap Engine**: If the target slot (out of the 6 slots) is occupied, the old item is automatically returned to the Bank inventory, and the new 32px item is equipped into the grid.

### 3. Unequipping & Hero-to-Hero Item Transfers
* **Click-to-Unequip**: Single-clicking an occupied equipment slot on a pinned hero card immediately sends that item back to the Bank inventory.
* **Drag-to-Transfer**: Dragging an equipped 32px item sprite off a hero card allows dropping it directly onto another hero card (hero-to-hero transfer) or back into the Bank drawer.

### 4. Direct In-Situ Equipping (Bank → Banner Playmat)
* Items can also be dropped directly onto a Hero's Card on a Banner playmat, triggering the exact same auto-equip and auto-swap behavior.

---

## 5. Gesture Physics & Tactile Drag Mechanics

### 1. Gesture Disambiguation (Click vs. Drag)
* **Press Down (`MouseDown`)**: Card depresses by 2px (`scale: 0.98`) with a subtle click-down audio cue. Initial cursor position `(startX, startY)` is recorded.
* **Distance Threshold (`> 5px`)**: 
  * If mouse is released within 5px total movement: Registered as a **CLICK** (toggles/pins card open).
  * If mouse moves > 5px: Registered as a **DRAG**.

### 2. Dual-Action Drag Mechanics: Pinned Dock + Compact Drag Token
When an upward drag is initiated (`dy < -5px`):
* **Dock Card Behavior**: The Hero Card in the dock **expands and pins open in place in the dock** so you can see its full stats during the action.
* **Cursor Avatar Behavior**: A compact **Drag Token** (the ~60px header / sprite) snaps out under the cursor to target banner slots.
* **Ghost Slot**: The original dock position displays a translucent ghost outline (`opacity: 0.35`).

### 3. Rejection & Recoil Mechanics
* **Valid Release**: Dropping onto a Banner Hero Slot snaps into place with a snap sound and particle accent; status badge updates to *"Banner X"*.
* **Invalid Release (Rubber-Band Physics)**: Dropping on empty space smoothly animates the Drag Token back into its dock slot using **spring recoil physics** (`stiffness: 300, damping: 20`) accompanied by a subtle recoil sound.

---

## 6. Architectural Pitfalls & Resolutions Matrix

| Pitfall | Resolution |
| :--- | :--- |
| **Screen Overcrowding from Pins** | Solved by **Strict Max 2-Card Pin Limit**. Pinning a 3rd card automatically closes the oldest card, keeping a clean side-by-side Hero A vs Hero B comparison. |
| **Friction Removing/Moving Items** | Solved by **Dual Unequip/Transfer**. Click slot to return item to Bank immediately; drag slot to transfer to another hero. |
| **Dragging Obscures Targets** | Solved by **Dock Pin + Compact Drag Token**. Full card pins open *in the dock*, while a small 60px token floats to the banner. |
| **Click vs Drag Confusion** | Solved by **5px Distance Threshold** + Press-down visual feedback. |
| **Failed Drag Frustration** | Solved by **Rubber-Band Spring Recoil**. Invalid drops smoothly snap back to dock with spring physics. |
| **Compact Screen Constraints** | Solved by responsive **Small Mode** (collapses headers into square portrait chips). |
