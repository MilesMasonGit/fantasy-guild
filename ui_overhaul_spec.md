# UI Overhaul Specification: Bubble Menu & Flexible Bottom Drawer System

This document outlines the design, layout, behavior, and structural specifications for transitioning the game's navigation and panel management to a unified **Bubble Menu (default Left) & Split Bottom Drawer System**.

---

## 1. System Overview [SYS-01]

The new interface relocates all global panels and navigation to an interactive column of "bubbles" (circular buttons), default-aligned to the left, but swappable to the right via settings. Clicking a bubble opens its target panel in one of three presentation containers:
1.  **Full-Screen Drawers:** Slide up to occupy the full screen (e.g., Guild Hall Upgrades, Pack Purchasing, Collection Binder, Area Manager).
2.  **Flexible Bottom Drawer:** Slides up from the bottom to occupy ~40-45% of the screen height. It can display 1, 2, or 3 panes side-by-side (Heroes, Cards, Bank) to allow multi-panel workflows (e.g., dragging items to heroes).
3.  **Centered Modals:** Focused overlays (Settings).

```
+-----+-------------------------------------------------------------+
| (G) |  Area Loops (Misty Mountains / Sunken Bog / etc.)           |
| [P] |                                                             |
| {H} |  [ WW Loop Row ] -> [Active Card]                           |
| |C| |                                                             |
| (B) |=============================================================|
| [X] |  Flexible Bottom Drawer (Height: ~40% - Splits 1 to 3 Panes)|
| [M] |  +-----------------------+-----------------------+--------+
| {*} |  | Heroes Pane           | Bank Pane             | Inspect|
|     |  | [Hero A] [Hero B]     | [Wood x10] [Sword]    | Panel  |
|     |  |                       |  (Drag item to Hero)  | Details|
+-----+-------------------------------------------------------------+
```

---

## 2. Global Navigation: Bubble Menu [COL-01]

- **Default Layout:** Positioned vertically on the **left side** of the screen.
- **Customization Setting:** A toggle in Settings allows swapping this column to the **right side**.
- **Visuals:** Rounded, tactile glassmorphic bubble buttons with smooth hover scaling and notification pips.
- **The Navigation Targets:**
  1.  **Guild Hall Upgrades** (Full-Screen)
  2.  **Pack Purchasing** (Full-Screen)
  3.  **Heroes Roster** (Bottom Drawer)
  4.  **Card Binder** (Bottom Drawer)
  5.  **Bank** (Bottom Drawer)
  6.  **Collection Binder** (Full-Screen - existing panel, new button trigger)
  7.  **Area Manager** (Full-Screen)
  8.  **Settings** (Centered Modal - existing modal, new button trigger)

---

## 3. Presentation Styles & Rules [PRES-01]

| Destination | Container Type | Multi-Open Rule | Interaction Description |
| :--- | :--- | :--- | :--- |
| **Guild Hall Upgrades** | Full-Screen Drawer | No | Covers screen. Includes upgrades and recruitment options. |
| **Pack Purchasing** | Full-Screen Drawer | No | Covers screen. Rudimentary layout: purchase button + open animations. |
| **Heroes Roster** | Flexible Bottom Drawer | Yes | Active roster grid. Drag-to-assign, drag equipment targets. |
| **Card Binder** | Flexible Bottom Drawer | Yes | Custom sorted card grid. Drag cards to Area Deck Slots. |
| **Bank** | Flexible Bottom Drawer | Yes | Tabbed resource grid. Drag gear to Heroes to equip. |
| **Collection Binder** | Full-Screen Drawer | No | Existing codex modal adapted to slide-up full-screen. |
| **Area Manager** | Full-Screen Drawer | No | Summary dashboard showing running state, toggles, and total economy. |
| **Settings** | Centered Modal | No | Existing settings modal triggered from bubble. |

### Bottom Drawer Multi-Pane Mechanics [BTM-01]
- **Tiling Columns:** Opening 1, 2, or 3 drawer targets dynamically splits the drawer width evenly (e.g., 3 open = three 33% columns).
- **Fullscreen Toggle:** Each pane header contains a `[ Maximize ]` button to expand that specific pane to cover 100% height (e.g., for full-screen Bank management).
- **Auto-Open:** Selecting an empty Hero Slot or Card Slot in an Area Row auto-slides open the Bottom Drawer with the corresponding pane loaded.

---

## 4. Component Details [FEAT-01]

### A. Bottom Drawer Components

#### 👥 1. Heroes Pane [COMP-HERO]
- **Roster Grid:** Grid of active heroes showing portrait, class, name, mini equipment slots, and a drag handle to drag them to active Area Rows.
- **No Vitals:** HP/EN bars are *not* displayed in this roster view (available on inspection).
- **No Recruitment:** Recruitment is migrated to the Guild Hall upgrades system.

#### 🎴 2. Card Binder Pane [COMP-CARD]
- **Sizing:** Cards are rendered at half-size, retaining the same shape as they appear on the playmat rows.
- **Sorting & Tabs:** Multi-tab sorting structure similar to the Bank. Players can drag and drop cards to rearrange/sort them manually inside the binder.
- **Drag Target:** Tiles can be dragged to Area Deck slots.

#### 🏦 3. Bank Pane [COMP-BANK]
- **Multi-Tab Grid:** Features a grid of items separated by **20 user-sortable tabs**.
- **Custom Organizing:** Players can drag and drop items between slots/tabs to organize their bank.
- **Search Bar:** Located in the header for fast item queries.
- **Drag Equipping:** Weapons/armor can be dragged directly onto a hero card in the adjacent Heroes Pane to equip.

#### 🔍 4. Shared Inspection Panel [COMP-INSPECT]
- **Behavior:** Standardized right-hand panel shared across all three bottom drawer panes.
- **Content:** Clicking a Hero, Card, or Item in any drawer panel loads its detailed sheet here (traits, lore, skill numbers, stats, and item **Sell controls**).

---

### B. Full-Screen Components

#### 🏛️ 5. Guild Hall Upgrades [COMP-GUILD]
- **Aesthetics:** Rudimentary list interface to start.
- **Features:**
  - Purchase global upgrades.
  - **Recruitment Center:** Spend Influence to hire new hero candidates.

#### 📦 6. Pack Purchasing [COMP-PACK]
- **Aesthetics:** Simple list/grid representing shop cards.
- **Features:** A button to purchase a booster pack with gold, triggering an immediate card reveal/opening sequence.

#### 🗺️ 7. Area Manager (Active Operations Dashboard) [COMP-AREA]
- **No Map UI:** Purely text/dashboard summary layout.
- **Thinner Area Banners:** Left side of the screen shows a stack of simple summary strips:
  `[Area Name] - [Hero Name] - [Active Card]`
- **Global Economy Panel:** Right side shows a live summary of the entire active economy (net items per hour, inputs vs. outputs).
- **Interactions:**
  - Playmat management (remove an area from playmat, or add/deploy new areas).
  - Hovering over an area strip displays a tooltip with the specific item outputs/income of that area.

---

## 5. UI Layout Wireframe Concept [WIRE-01]

```
+-----+-------------------------------------------------------------+
| (G) |  Area Loops (Misty Mountains / Sunken Bog / etc.)           |
| [P] |                                                             |
| {H} |  [ WW Loop Row ] -> [Active Card]                           |
| |C| |                                                             |
| (B) |=============================================================|
| [X] |  Flexible Bottom Drawer                                     |
| [M] |  +--------------------+-------------------+---------------+  |
| {*} |  | Heroes Pane        | Bank Pane         | Shared        |  |
|     |  | [Hero A] [Hero B]  | [Wood] [Sword]    | Inspect Panel |  |
|     |  |                    |                   | [Sword Details|  |
|     |  |                    |                   |  Sell: [ 10g ]|  |
|     |  +--------------------+-------------------+---------------+  |
+-----+-------------------------------------------------------------+
```
