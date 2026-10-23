# Backlog Intake & Ticket Drafts for Planning Agent

*Compiled during owner design & issue review session. No code changes executed during this session.*

---

## Ticket Intake Log

### [TOPBAR-01] Top Bar Region Name Banner Redesign
- **Area**: UI / Playmat Top Bar (`src/ui/components/board/MatRegionName.jsx`, `MatTopBar.jsx`)
- **Current Behavior**: The region icon is displayed as a badge (`EntityRibbon` with `TopBarIcon`). The banner slice behind it is small and constrained.
- **Desired Behavior**: 
  - Remove/rework the standalone badge style for the region icon.
  - The region's background art should serve as the actual background of the region banner.
  - The background image should start crisp/prominent on the left and smoothly fade out toward the right.
- **Target Files**:
  - [`src/ui/components/board/MatRegionName.jsx`](../../../src/ui/components/board/MatRegionName.jsx)
  - [`src/ui/components/board/MatTopBar.jsx`](../../../src/ui/components/board/MatTopBar.jsx)

---

### [TOPBAR-02] Top Bar Typography & Element Sizing Scaling
- **Area**: UI / Playmat Top Bar (`src/ui/components/board/MatTopBar.jsx`, `MatCapBadge.jsx`, `MatUpkeepBadge.jsx`, `MatRegionName.jsx`)
- **Current Behavior**: Text and items in the top bar are compact (`MAT_TOP_BAR_PX = 44`, small icons at 16px, small body text).
- **Desired Behavior**:
  - Increase the scale of text and interactive items across the top bar to be noticeably larger, more readable, and prominent.
  - Capitalize on the newly available vertical space freed up by the playmat height reduction.
- **Target Files**:
  - [`src/ui/components/board/MatTopBar.jsx`](../../../src/ui/components/board/MatTopBar.jsx)
  - [`src/ui/components/board/MatCapBadge.jsx`](../../../src/ui/components/board/MatCapBadge.jsx)
  - [`src/ui/components/board/MatUpkeepBadge.jsx`](../../../src/ui/components/board/MatUpkeepBadge.jsx)

---

### [TOPBAR-03] Top Bar Layout Alignment & Mat Width Constrainment
- **Area**: UI Layout & Composition (`src/ui/components/board/MatTopBar.jsx`, `src/ui/ReactRoot.jsx`, `MatModeControls.jsx`)
- **Current Behavior**: Top bar spans 100% full width (`w-full`) across the board area; Tokens cap and Upkeep badges are grouped tightly on the left next to Region name; Disallow and Demolish toggles are pushed to the outer right edge.
- **Desired Behavior**:
  - **Width Containment**: The top bar must be constrained to the exact same width as the playmat underneath it (matching playmat edges instead of stretching edge-to-edge).
  - **Tokens & Upkeep**: Reposition the Tokens count/cap and Upkeep tabs more centrally (in the center of the top bar).
  - **Disallow & Demolish Toggles**: Adjust the Disallow and Demolish controls inwards from the right edge, matching the constrained playmat boundary.
- **Target Files**:
  - [`src/ui/components/board/MatTopBar.jsx`](../../../src/ui/components/board/MatTopBar.jsx)
  - [`src/ui/components/board/MatModeControls.jsx`](../../../src/ui/components/board/MatModeControls.jsx)
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx)

---

### [MAT-01] Playmat Aspect Ratio & Dimension Tuning (Wider, Shorter Height)
- **Area**: Playmat Geometry & Layout (`src/config/matGeometry.js`, `src/ui/hooks/useBoardScale.js`, `src/ui/components/board/Board.jsx`)
- **Current Behavior**:
  - Playmat size is governed by `MAT_STEPS = 11` (160u steps = 1760u wide) and fixed aspect ratio `MAT_ASPECT = 0.64` (height = 1126u).
  - Vertical height takes up significant space relative to width, leaving less room for taller headers/bars without shrinking the whole mat.
- **Desired Behavior**:
  - Slightly **increase the width** of the playmat.
  - Slightly **reduce the height** of the playmat (tuning down `MAT_ASPECT`).
  - Utilizes the available viewport space better horizontally and opens up vertical headroom for a more prominent, readable top bar.
- **Target Files**:
  - [`src/config/matGeometry.js`](../../../src/config/matGeometry.js)
  - [`src/ui/hooks/useBoardScale.js`](../../../src/ui/hooks/useBoardScale.js)
  - [`src/ui/components/board/Board.jsx`](../../../src/ui/components/board/Board.jsx)

---

### [TOKEN-01] Token Hitbox & Placement Spacing Increase
- **Area**: Mat Placement & Token Physics (`src/config/matTuning.js`, `src/systems/board/MatPlacement.js`, `src/config/matGeometry.js`)
- **Current Behavior**:
  - Tokens sit relatively close to one another based on `hitboxPct` (currently default 80% in `matTuning.js`) and `overlapPct` (default 40%).
  - Tokens can feel crowded on the mat during manual placement, drops, and nudging.
- **Desired Behavior**:
  - Slightly **increase the hitboxes of the tokens** (e.g., raise `hitboxPct` or tighten overlap allowance) so tokens enforce more space between each other when placed.
- **Target Files**:
  - [`src/config/matTuning.js`](../../../src/config/matTuning.js) (key `hitboxPct`, `overlapPct`)
  - [`src/systems/board/MatPlacement.js`](../../../src/systems/board/MatPlacement.js) (`hitRadiusOf`, `minGap`)
  - [`src/tests/MatPlacement.test.js`](../../../src/tests/MatPlacement.test.js)

---

### [DRAG-01] Remove Full-Mat Allowed Drop Glow (Only Highlight Disallowed Drop Cells)
- **Area**: Gameplay / Drag & Drop Feedback (`src/ui/components/board/TerrainGridOverlay.jsx`, `GroundRules.js`)
- **Current Behavior**:
  - When dragging a token with ground restrictions (e.g. boat or water-bound tokens), `TerrainGridOverlay` paints every allowed cell with `GRID_LIT` (`[255, 236, 170, 46]` with checker modulation).
  - Because most cells on the mat are valid, this creates an intense glowing wash over virtually the entire playmat.
- **Desired Behavior**:
  - Keep valid drop locations **completely unpainted/transparent** so the playmat looks natural and unaltered where drops are allowed.
  - Only highlight **disallowed cells** (e.g. water tiles for land-only tokens, or land for water tokens) using a distinct disallowed tint/color (e.g. soft warning/dim overlay) so players clearly see forbidden zones without obscuring the rest of the board.
- **Target Files**:
  - [`src/ui/components/board/TerrainGridOverlay.jsx`](../../../src/ui/components/board/TerrainGridOverlay.jsx) (`paintGrid`, `GRID_LIT`, `GRID_DIM`)
  - [`src/tests/TerrainPlacement.test.js`](../../../src/tests/TerrainPlacement.test.js)

---

### [HERO-01] Hero Inventory Slot Drop Animation & Redesign
- **Area**: UI / Hero Inspection Panel (`DockEquipmentGrid.jsx`, `src/tailwind.css`)
- **Current Behavior**:
  - Equipping or dropping an item into an equipment/inventory slot triggers `gi-item-equipped-bob` (`animation: gi-item-equipped-bob 600ms cubic-bezier(0.34, 1.56, 0.64, 1)`), which scales the slot up (`scale(1.06)`), bounces it, and gives it a glowing drop shadow (`drop-shadow(0 0 10px rgba(245, 158, 11, 0.9))`).
  - This feels excessively flashy, bouncy, and conflicts with the clean pixel art style.
- **Desired Behavior**:
  - Redo and simplify the slot equip response to be cleaner and less flashy.
  - Eliminate the scale-up bounce and blurred glow.
  - Apply the new pixel **glint / shine system** (`.ui-shine` sweep) to the slot upon equipping to give a crisp, stylish, and subtle confirmation.
- **Target Files**:
  - [`src/ui/components/dock/DockEquipmentGrid.jsx`](../../../src/ui/components/dock/DockEquipmentGrid.jsx) (lines 144-150)
  - [`src/tailwind.css`](../../../src/tailwind.css) (`.gi-item-equipped-bob`, `.ui-shine`)

---

### [HERO-02] Slot Category Badge Icons in Hero Inventory Bottom-Right Corner
- **Area**: UI / Hero Inventory Grid (`DockEquipmentGrid.jsx`, `equipmentConstants.js`, `equipmentCategories.js`)
- **Current Behavior**:
  - Equipment slots in the hero inventory grid do not visually communicate the item's category/slot type at rest unless hovered.
- **Desired Behavior**:
  - Place small, simple pixel icons in the **bottom-right corner** of each inventory slot indicating what kind of item it is:
    - E.g., Hand icon for hand items/weapons (`hand`), Drink icon for drinks (`drink`), Food icon for food (`food`), Hat/Armor/Trinket icons accordingly.
  - Keeps the slot visually informative at a glance while fitting cleanly into the pixel art aesthetic.
- **Target Files**:
  - [`src/ui/components/dock/DockEquipmentGrid.jsx`](../../../src/ui/components/dock/DockEquipmentGrid.jsx) (`EquipSlotBody`)
  - [`src/config/registries/equipmentConstants.js`](../../../src/config/registries/equipmentConstants.js)
  - [`src/config/registries/equipmentCategories.js`](../../../src/config/registries/equipmentCategories.js)

---

### [ITEM-01] Item Display Background & Category Tinting in Bank and Inventory
- **Area**: UI / Items & Drawers (`BankTab.jsx`, `DockEquipmentGrid.jsx`, `ItemTile`)
- **Current Behavior**:
  - Item tiles and slots currently use flat, dark backgrounds (`bg-gi-base/60`, `bg-black/40`, etc.).
  - Dark-colored item sprite outlines blend directly into the dark backgrounds and lose silhouette definition.
- **Desired Behavior**:
  - Shift background color slightly on hover / mouseover to provide active feedback.
  - Implement subtle background tinting based on the item's **category/type** (e.g. Weapons, Armor, Tools, Materials, Food/Consumables) to provide visual contrast that makes the pixel sprite and its dark outlines pop distinctly against the tile surface.
- **Target Files**:
  - [`src/ui/components/drawer/BankTab.jsx`](../../../src/ui/components/drawer/BankTab.jsx) (`ItemTile`, `ItemTileBody`)
  - [`src/ui/components/dock/DockEquipmentGrid.jsx`](../../../src/ui/components/dock/DockEquipmentGrid.jsx) (`EquipSlotBody`)
  - [`src/config/registries/equipmentConstants.js`](../../../src/config/registries/equipmentConstants.js) (`categoryOfItem`)

---

### [ATLAS-01] Atlas Regions Book Layout Rework (Banners & Right-Page Map Preview)
- **Area**: UI / Atlas Tome (`src/ui/components/atlas/RegionList.jsx`, `AtlasTome.jsx`, `MapPreview.jsx`)
- **Current Behavior**:
  - In `RegionList`, settled regions are split half-and-half across both pages of the book (first half on the left page, second half on the right page).
  - Region banners within rows are generic narrow strips.
- **Desired Behavior**:
  - **Nicer Region Banners**: Polish and improve the visual layout and presentation of region banners in the list.
  - **Two-Page Book Workflow**:
    - **Left Page**: Dedicated to the selectable list of settled/available regions.
    - **Interactive Selection**: Clicking a region marks it selected.
    - **Right Page**: Instead of holding the list overflow, the right page displays a **visual preview of what that map looks like** (integrating `MapPreview`), complete with its terrain, key stats, landmarks, and action buttons (Travel, Rename, Archive).
- **Target Files**:
  - [`src/ui/components/atlas/RegionList.jsx`](../../../src/ui/components/atlas/RegionList.jsx)
  - [`src/ui/components/atlas/MapPreview.jsx`](../../../src/ui/components/atlas/MapPreview.jsx)
  - [`src/ui/components/atlas/AtlasTome.jsx`](../../../src/ui/components/atlas/AtlasTome.jsx)

---

### [DEV-01] De-Clutter QA, Ground & Tuner Panels
- **Area**: Developer Tools / QA Interface (`PlaymatTuner.jsx`, `MatTuner.jsx`, `TestDashboard.jsx`, `TerrainDevSection.jsx`)
- **Current Behavior**:
  - The developer overlay is currently cluttered with multiple separate floating and embedded tools: `PlaymatTuner` (terrain and ground appearance), `MatTuner` (physics and collision dials), and `TerrainDevSection` in the QA dashboard.
  - Since the ground and terrain visuals have settled into a solid, finalized state, these redundant floating panels create unnecessary visual clutter during testing.
- **Desired Behavior**:
  - De-clutter the developer QA UI by retiring or hiding the standalone `PlaymatTuner` and redundant ground tuning panels.
  - Keep the QA panel clean, streamlined, and focused on active mechanics testing (spawning items, advancing timers, hero progression, performance HUD).
- **Target Files**:
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx) (lines 413-414: `<PlaymatTuner />`, `<MatTuner />`)
  - [`src/ui/components/TestDashboard.jsx`](../../../src/ui/components/TestDashboard.jsx) (`TerrainDevSection`)
  - [`src/ui/components/PlaymatTuner.jsx`](../../../src/ui/components/PlaymatTuner.jsx)

---

### [GUILD-01] Suppress Toast / Banner Notifications on Guild Upgrade Screen
- **Area**: UI / Guild Hall View (`src/ui/ReactRoot.jsx`, `ItemStubColumn.jsx`, `BannerStack.jsx`)
- **Current Behavior**: While viewing the Guild Hall upgrade screen (`isGuildView`), item stubs and toast banners (`ItemStubColumn` and `BannerStack`) still render over the screen.
- **Desired Behavior**: Suppress/hide all toast notifications and item stubs when the player is inside the Guild Hall upgrade screen.
- **Target Files**:
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx) (condition around lines 278-281: `!isGuildView && (<ErrorBoundary label="Notifications">...)`)

---

### [GUILD-02] Smooth Motion for Guild Hall Starry Sky Backdrop
- **Area**: Visuals / Animation (`src/tailwind.css`, `src/ui/components/board/HallSky.jsx`)
- **Current Behavior**:
  - The starry backdrop animation uses `steps(512, end)` (`animation: gi-sky-drift-stars 600s steps(512, end) infinite;`), which advances position in discrete art pixel steps every ~1.17s.
  - This stepped movement appears as jitter / low-framerate stuttering during gameplay.
- **Desired Behavior**: Experiment with smooth, continuous motion (e.g. `linear` easing instead of discrete `steps(...)`) for the star background drift so it glides seamlessly across the screen.
- **Target Files**:
  - [`src/tailwind.css`](../../../src/tailwind.css) (`.gi-sky-drift-stars`, `.gi-sky-drift-clouds`)
  - [`src/ui/components/board/HallSky.jsx`](../../../src/ui/components/board/HallSky.jsx)
  - [`src/tests/HallSky.test.js`](../../../src/tests/HallSky.test.js)

---

### [GUILD-03] Guild Upgrade Star Node States & Remove Blinking
- **Area**: Visuals / Guild Hall Web (`src/ui/components/board/GuildHallBoard.jsx`, `src/tailwind.css`)
- **Current Behavior**:
  - Buyable star nodes currently blink on and off via `.gi-star-twinkle` (`animation: gi-star-twinkle 1.6s steps(1, end) infinite`).
  - Star states do not cleanly map to the intended 3-state artwork roles.
- **Desired Behavior**:
  - **Remove blinking**: Eliminate the `gi-star-twinkle` blink animation entirely; star nodes should be steady.
  - **3 Distinct Star States**:
    1. **Gold Star** (`ui_star_gold.png`): Completed / maxed nodes.
    2. **White / Grey Star** (`ui_star_grey.png`): Nodes that have not had anything upgraded on them yet (unbought / 0 ranks).
    3. **Blue Star** (`ui_star_blue.png`): Nodes that have potential upgrades available to be bought.
- **Target Files**:
  - [`src/ui/components/board/GuildHallBoard.jsx`](../../../src/ui/components/board/GuildHallBoard.jsx) (`STAR_SPRITES`, node state logic, line 292 className)
  - [`src/tailwind.css`](../../../src/tailwind.css) (`gi-star-twinkle`)
  - [`src/tests/HallSky.test.js`](../../../src/tests/HallSky.test.js)

---

### [GUILD-04] Rework Guild Hall Panels (Effects to Tooltip, Modernize Inspect Panel)
- **Area**: UI / Guild Hall View (`GuildHallEffectsPanel.jsx`, `InspectionPanel.jsx`, `ReactRoot.jsx`)
- **Current Behavior**:
  - Both panels (the left-hand Guild Hall Effects panel and the right-hand Inspect panel) use older UI styling (rounded borders, gradient fills, drop shadows) that don't match the modern pixel frame / pixel art visual aesthetic.
  - Guild Hall Effects occupies a static, dedicated left column (`EFFECTS_COLUMN`), squeezing horizontal space for the upgrade constellation web.
- **Desired Behavior**:
  - **Guild Hall Effects**: Convert from a persistent full-height side box into a **tooltip / popover** (e.g., triggered on hovering/inspecting the central Guild Hall star or an icon), freeing up the entire left side for the starry web.
  - **Inspect Panel**: Keep its position on the right side and retain the detailed upgrade information, but rework its styling (frames, headers, buttons) to conform to the current pixel art visual design language (`PixelFrame`, hard borders, consistent typography).
- **Target Files**:
  - [`src/ui/components/board/GuildHallEffectsPanel.jsx`](../../../src/ui/components/board/GuildHallEffectsPanel.jsx)
  - [`src/ui/components/inspect/InspectionPanel.jsx`](../../../src/ui/components/inspect/InspectionPanel.jsx)
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx)

---

### [GUILD-05] Camera Glide Transition When Entering Guild Hall Screen (T-194)
- **Area**: Visuals / Screen Transitions (`src/ui/ReactRoot.jsx`, `AtlasCamera.jsx`, git tag `atlas-camera-move`)
- **Current Behavior**: Opening the Guild Hall upgrade screen cuts straight into the starry sky without a transition.
- **Desired Behavior**:
  - Restore the smooth camera glide animation looking upward from the wooden table playmat screen toward the night sky and stars.
  - Note: Previously prototyped at git tag `atlas-camera-move` (`7a678567`, `AtlasCamera.jsx`), skippable on click, respected by reduced motion.
- **Target Files**:
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx)
  - Prior art at git tag `atlas-camera-move` (7a678567)
  - [`docs/reference/TICKETS.md`](../../../docs/reference/TICKETS.md) (T-194)

---

### [DRAWER-01] Bank & Shop Drawer Left-Side Visual Cohesion (Under Nav Orbs)
- **Area**: UI Drawers (`src/ui/components/drawer/ShopDrawer.jsx`, `BankDrawer.jsx`)
- **Current Behavior**:
  - In `ShopDrawer`, the drawer starts at `left-[84px] md:left-[152px]`, leaving an empty cutout behind the left navigation orbs where the playmat shows through awkwardly.
  - In `BankDrawer`, the area under the navigation orbs appears as a flat, disconnected gray bar/gutter (`bg-gi-surface`).
- **Desired Behavior**:
  - Redesign the backing of both drawers so the sliding drawer feels like one complete, unified panel extending all the way to the screen edge under the navigation orbs, without exposed playmat gaps or mismatched gray bars.
- **Target Files**:
  - [`src/ui/components/drawer/ShopDrawer.jsx`](../../../src/ui/components/drawer/ShopDrawer.jsx)
  - [`src/ui/components/drawer/BankDrawer.jsx`](../../../src/ui/components/drawer/BankDrawer.jsx)

---

### [DRAWER-02] Smooth Layout Transition Choreography When Opening Bank Drawer
- **Area**: Layout & Transitions (`src/ui/ReactRoot.jsx`, `Board.jsx`, `BankDrawer.jsx`)
- **Current Behavior**:
  - When the Bank drawer opens, the placeholder `<aside>` mounts abruptly, causing the playmat, top bar, and notifications to immediately snap or jerk to the side before the drawer finishes sliding.
- **Desired Behavior**:
  - Coordinate and animate the surrounding elements out of the way smoothly:
    - Top bar slides up smoothly.
    - Notification column slides back off to the right.
    - Playmat translates smoothly out of the way.
  - Eliminates jarring layout shifts / popping during drawer open and close animations.
- **Target Files**:
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx)
  - [`src/ui/components/drawer/BankDrawer.jsx`](../../../src/ui/components/drawer/BankDrawer.jsx)
  - [`src/ui/components/board/MatTopBar.jsx`](../../../src/ui/components/board/MatTopBar.jsx)

---

### [UI-01] Global Audit & Migration to Chamfered Pixel Borders Across Windows & Frames
- **Area**: UI Visual System / Styling (`PixelFrame.jsx`, modals, inspect panels, drawers, tooltips)
- **Current Behavior**:
  - Multiple windows, dialogs, drawers, and modal panels throughout the UI still use generic browser-style rounded corners (`rounded-xl`, `rounded-2xl`, etc.) and blurred CSS drop shadows.
- **Desired Behavior**:
  - Conduct a full audit of all UI windows, dialogs, drawers, and inspect containers.
  - Replace generic rounded corners with the new pixelated **chamfered borders** (`PixelFrame` with `FRAME_KIND.CHAMFER` / `ui-frame-chamfer`) for floating windows, modals, popovers, and tooltips (and `FRAME_KIND.STUDS` for docked panels), ensuring hard pixel borders and shadows are used consistently everywhere.
- **Target Files**:
  - [`src/ui/components/base/PixelFrame.jsx`](../../../src/ui/components/base/PixelFrame.jsx)
  - Modals in [`src/ui/modals/`](../../../src/ui/modals/) (e.g. `SettingsModal.jsx`, `SlotSelectionModal.jsx`)
  - Inspect components in [`src/ui/components/inspect/`](../../../src/ui/components/inspect/) (e.g. `InspectionPanel.jsx`, `TokenInspection.jsx`)
  - Dev/tuner tools (`MatTuner.jsx`, `PlaymatTuner.jsx`, `AnimationStudioModal.jsx`)

---

### [DOCK-01] Work Permissions Button & Drawer Rework
- **Area**: UI / Bottom Hero Dock & Work Permissions (`WorkRulesDrawer.jsx`, `BottomHeroDock.jsx`, `workRules.js`)
- **Current Behavior**:
  - **Button Styling & Position**: The Work Permissions button is a flat, flimsy slot pinned to the far left (`LAUNCHER_PX = 136px`, `left-0`) outside the playmat bounds. It lacks depth and doesn't look like a solid, tactile button.
  - **Button Placement**: It sits off to the left side of the hero bar rather than neatly anchored underneath the playmat.
  - **Drawer Slide Animation**: Drawer slide motion starts abruptly from behind the dock rather than gliding up from underneath the hero bar / screen bottom.
  - **Column Order**: Combat is placed as the final column after Starting and Specialist skill groups (`ruleGroups()`).
  - **Borders**: Uses standard CSS rounded borders (`rounded-t-lg`) and blurred shadows instead of chamfered pixel frames.
- **Desired Behavior**:
  - **Tactile Button**: Give the Work Permissions button more substance, depth, and a prominent pixel/chamfered border so it looks and feels like a real interactive button.
  - **Playmat Alignment**: Position the button directly underneath the playmat (within or aligned to the mat's horizontal bounds) rather than floating off to the far left.
  - **Bottom Slide-Up Animation**: Ensure the drawer smoothly slides up from underneath the hero bar / bottom of the screen.
  - **Combat First**: In `ruleGroups()`, place **Combat as the very first option / column** (left-most), before Starting and Specialist skills.
  - **Chamfered Pixel Frame**: Upgrade the drawer container and button framing using our pixel chamfered border system (`PixelFrame` / `FRAME_KIND.CHAMFER`).
- **Target Files**:
  - [`src/ui/components/dock/WorkRulesDrawer.jsx`](../../../src/ui/components/dock/WorkRulesDrawer.jsx) (`WorkRulesButton`, `WorkRulesDrawer`, `RulesGrid`)
  - [`src/ui/components/dock/BottomHeroDock.jsx`](../../../src/ui/components/dock/BottomHeroDock.jsx) (layout, launcher placement)
  - [`src/ui/components/dock/workRules.js`](../../../src/ui/components/dock/workRules.js) (`ruleGroups`)
  - [`src/tests/WorkPermissions.test.js`](../../../src/tests/WorkPermissions.test.js)

---

### [NOTIF-01] Dismiss "New!" Icon on Item Stubs When Moused Over or Pinned
- **Area**: UI & Systems / Notifications & Item Stubs (`ItemStubColumn.jsx`, `itemStubs.js`, `routing.js`)
- **Current Behavior**:
  - When an item stub is generated for a newly discovered item, its stub state is flagged with `isNew: true`.
  - The stub displays a golden `"New!"` badge and a gold chamfer highlight (`ui-frame-chamfer-gold`, `gi-stub-new`).
  - Currently, `isNew` remains active on the stub indefinitely until the stub expires or is manually cleared; hovering/mousing over the stub or pinning it does not dismiss the "New!" indicator.
- **Desired Behavior**:
  - The "New!" badge and gold highlight must immediately disappear once the item stub has been **moused over (hovered)** or **pinned** by the player.
  - Expose a dismissal function (e.g. `ItemStubs.clearNew(itemId)` / `ItemStubs.dismissNew(itemId)`), automatically invoked when:
    1. A stub is moused over in `ItemStubColumn.jsx` (`onMouseEnter` / `onHover`).
    2. A stub is pinned in `itemStubs.js` (`pin(itemId)` clears `isNew: false`).
- **Target Files**:
  - [`src/systems/notifications/itemStubs.js`](../../../src/systems/notifications/itemStubs.js) (`pin`, new `dismissNew` / `clearNew`)
  - [`src/ui/components/notifications/ItemStubColumn.jsx`](../../../src/ui/components/notifications/ItemStubColumn.jsx) (`Stub`, `OpenStub`, hover handlers)
  - [`src/systems/notifications/routing.js`](../../../src/systems/notifications/routing.js) (`pins.pin`, `pins`)
  - [`src/tests/ItemStubs.test.js`](../../../src/tests/ItemStubs.test.js)

---

### [LOOT-01] Disable Loot Burst Particle Effect on Playmat Tasks
- **Area**: Visual FX & Performance / Playmat Loot (`SpriteLayerView.jsx`, `lootArc.js`, `tokenFx.js`, `ParticleOverlay.jsx`)
- **Current Behavior**:
  - When a station or task on the playmat completes and outputs loot (`SpriteLayer.addSprite`), items hop onto the mat accompanied by a particle/trail effect:
    - Trailing dithered afterimages (`afterimages` in `lootArc.js` / `tokenFx.js`).
    - Flashes/twinkles for rare drops (`playRareTwinkle`).
    - Flying loot particle canvas / sparkle trails (`ParticleOverlay.jsx` / `spawnCollected`).
  - This effect causes noticeable framerate drops/stuttering and does not meet the visual standard ("doesn't look good").
- **Desired Behavior**:
  - Disable / turn off the particle and afterimage effect on item loot bursts from tasks for now.
  - Allow items to drop/land cleanly onto the playmat without creating trailing particle DOM nodes or firing heavy canvas particle bursts during task completion.
- **Target Files**:
  - [`src/ui/components/board/SpriteLayerView.jsx`](../../../src/ui/components/board/SpriteLayerView.jsx) (`LootSprite`, `playLootArc`)
  - [`src/ui/utils/lootArc.js`](../../../src/ui/utils/lootArc.js) (`playLootArc`, `afterimages`)
  - [`src/ui/components/board/fx/tokenFx.js`](../../../src/ui/components/board/fx/tokenFx.js) (`afterimages`)
  - [`src/ui/components/base/ParticleOverlay.jsx`](../../../src/ui/components/base/ParticleOverlay.jsx) (`ParticleSystem`, `spawnCollected`)
  - [`src/ui/dev/perf/drawSwitches.js`](../../../src/ui/dev/perf/drawSwitches.js)

---

### [TOKEN-02] Token Name Badge Position (Move from Top to Bottom)
- **Area**: UI / Playmat Tokens (`TokenBadges.jsx`, `MatToken.jsx`, `MatHero.jsx`)
- **Current Behavior**:
  - `TokenNameBadge` is currently positioned above the token (`bottom: calc(100% + ${4 + lift}px)`).
  - On larger tokens, or when tokens have health bars, timers, or overhangs that add `lift`, the name badge floats high in the air, feeling detached and disconnected from the token art ("looks a little bit far away").
- **Desired Behavior**:
  - Position the token's name badge at the **bottom** of the token instead of the top (e.g. `top: calc(100% + 4px)`), centered under the token footprint.
  - Ensures a tight, grounded association between the name and the token art without colliding with top-anchored status indicators.
- **Target Files**:
  - [`src/ui/components/board/TokenBadges.jsx`](../../../src/ui/components/board/TokenBadges.jsx) (`TokenNameBadge`, lines 107-132)
  - [`src/ui/components/board/MatToken.jsx`](../../../src/ui/components/board/MatToken.jsx) (line 587)
  - [`src/ui/components/board/MatHero.jsx`](../../../src/ui/components/board/MatHero.jsx) (line 276, verify if hero name badge should follow or stay above head)

---

### [BUBBLE-01] Hero-Token Work Connection & Interactive Bubble Row
- **Area**: UI & UX / Hero Status & Token Feedback (`HeroBubbleLayer.jsx`, `TokenBubbles.jsx`, `heroBubbles.js`, `bubbleLayout.js`)
- **Current Behavior**:
  - Status indicators and feedback are fragmented across different places:
    - Heroes speak temporary text bubbles floating over their heads (`HeroBubbleLayer.jsx`).
    - Tokens show separate rings, gears, problem marks, and work bars scattered directly inside or around the token's bounding box (`TokenBubbles.jsx`).
  - It is often ambiguous to players **which token a hero is currently working on**, and what the various scattered icons/bubbles mean.
- **Desired Behavior**:
  - **Spacial Anchor Between Hero & Token**: When a hero is assigned to / actively working a token, display a unified bubble cluster/indicator that pops up and lives **between the hero and the token**, making their connection immediately legible at a glance.
  - **Organized Row of Bubbles**: Present the relevant status indicators as a neat, cohesive horizontal row of bubbles (e.g., active task/skill, recipe output, remaining charges/timer, alert/problem).
  - **Interactive Hover Tooltips**: Allow the player to hover over any bubble in this row to read clear, explanatory tooltips that demystify what the hero is doing and what each icon means.
- **Target Files**:
  - [`src/ui/components/board/HeroBubbleLayer.jsx`](../../../src/ui/components/board/HeroBubbleLayer.jsx)
  - [`src/ui/components/board/TokenBubbles.jsx`](../../../src/ui/components/board/TokenBubbles.jsx)
  - [`src/ui/components/board/heroBubbles.js`](../../../src/ui/components/board/heroBubbles.js)
  - [`src/ui/components/board/bubbleLayout.js`](../../../src/ui/components/board/bubbleLayout.js)
  - [`src/ui/components/board/flagText.js`](../../../src/ui/components/board/flagText.js)

---

### [COMBAT-01] Combat System Overhaul & Deep Dive Specification (Planning Agent Scope)
- **Area**: Game Design, Systems Architecture, & Combat Engine (`concept_combat.md`, `GDD.md`, `src/systems/combat/`)
- **Current Behavior**:
  - Combat functions in a rudimentary way (basic turn-based hits, flat damage formulas, basic HP bars) and currently lacks mechanical and strategic depth.
  - While other systems (equipment slots, category badges, food/potions consumables) are now well-defined, combat has not yet integrated these elements into a cohesive loop.
- **Desired Behavior**:
  - Designate a **dedicated Planning Agent** session to execute an exhaustive deep dive and author the complete combat overhaul specification.
  - **Planning Agent Scope to Cover**:
    1. **Formulas & Scaling**: Weapon damage formulas, armor defense ratings, attack speed curves, and level scaling.
    2. **Combat Styles & Asymmetry**: Tactical identities and traits for the 4 combat skills (Melee, Ranged, Magic, Stealth).
    3. **Consumables Integration**: Rules for automated consumption of equipped food (Cooking) and potions (Alchemy) during battle, sustain rates, and cooldowns.
    4. **Encounter Variety**: Static enemy camps, node ambushes, resource guardians, and multi-hero party boss fights.
    5. **Combat Status Effects**: Standardizing status procs (Poison, Burn, Bleed, Stun, Shield) through the Rules engine.
    6. **Loot & XP Rewards**: Combat skill XP scaling, item drop tables, and map discoverability through combat.
- **Target Files & References**:
  - Concept doc: [`docs/active/concept_combat.md`](../../../docs/active/concept_combat.md)
  - Design doc: [`docs/reference/GDD.md`](../../../docs/reference/GDD.md) (§6 Combat and enemies)
  - Core engine: [`src/systems/combat/`](../../../src/systems/combat/) (`CombatEngine.js`, `BoardCombat.js`, `LootSystem.js`)
  - Combat formulas: [`src/utils/CombatFormulas.js`](../../../src/utils/CombatFormulas.js)

---

### [CONTENT-01] World Map Content Implementation & Progression Structure (Planning Agent Scope)
- **Area**: Content Design, Progression Architecture & Atlas Cartography (`data/items.json`, `data/tokens.json`, `mapItems.js`, `Cartography.js`, `Budget.js`)
- **Current Behavior**:
  - The Atlas Cartography engine, layout generator, and tome interface are fully built, but actual authored map content is minimal or consists of test/placeholder items.
  - Progression gating (how acquiring maps unlocks higher-tier resources, tools, enemies, and materials) lacks a structured, playable content chain.
- **Desired Behavior**:
  - Designate a **dedicated Content Planning Agent** to design and author a playable starter-to-midgame world content suite.
  - **Content Planning Scope to Cover**:
    1. **Core Base Map Roster**: Define a set of distinct base maps spanning early-to-mid progression (e.g. Whispering Woods, Sunken Quarry, Boglands, Ashen Peaks, Ancient Ruins), each with distinct biomes, ground palettes, water shapes, and generation point budgets.
    2. **Token Distribution & Node Pools**: Specify the tokens populated on each map (resource harvesting nodes, enemy camps, treasures, landmark foundations).
    3. **Map Acquisition & Gating Chain**: Define how each map is acquired (which enemy drops it, bounty payout weight, quest/milestone rewards, or shop purchase), establishing a clear progression gating structure.
    4. **Item & Material Tier Alignment**: Ensure new raw materials (copper, iron, herbs, hardwood, creature drops) and the gear/recipes gated behind them map cleanly onto specific region types.
    5. **Playable Baseline State**: Provide a concrete, cohesive baseline in `items.json` / `tokens.json` so the full loop from Starter Camp -> Map Discovery -> Region Settling -> New Tier Crafting is immediately playable for testing and subsequent tuning.
- **Target Files & References**:
  - Atlas engine: [`src/systems/atlas/mapItems.js`](../../../src/systems/atlas/mapItems.js)
  - Map generation: [`src/systems/atlas/Cartography.js`](../../../src/systems/atlas/Cartography.js), [`src/systems/atlas/Budget.js`](../../../src/systems/atlas/Budget.js)
  - Content database: `data/items.json`, `data/tokens.json`, `data/starterCamp.json`
  - Design references: [`docs/active/concept_atlas.md`](../../../docs/active/concept_atlas.md), [`docs/reference/GDD.md`](../../../docs/reference/GDD.md)

---

### [BANK-01] Retire Bank Inspect Pane, Enrich Item Tooltips & Inline Search Bar
- **Area**: UI & UX / Bank Drawer (`BankDrawer.jsx`, `BankTab.jsx`, `InspectionPanel.jsx`)
- **Current Behavior**:
  - `BankDrawer` mounts a permanent side `InspectionPanel` column taking up large horizontal space.
  - The item search input currently lives inside that separate `InspectionPanel`.
  - Item tile tooltips show basic generic instructions (`"Drag to sort, or onto a hero to equip"`), which is redundant clutter.
- **Desired Behavior**:
  - **Retire Inspect Pane**: Remove the `InspectionPanel` from `BankDrawer` entirely. Clicking an item no longer needs a heavy side panel, maximizing space for the bank grid.
  - **Enrich Item Tooltips**:
    - Remove the generic text `"Drag to sort, or onto a hero to equip"`.
    - Display all necessary item details directly in the hover tooltip: name, count, item type/tags, stats/effects, what it writes (if map), and equippability.
    - If the item is equippable, include an explicit badge/tag (e.g. `Equippable: Hand`, `Equippable: Hat`, `Equippable: Drink`, `Equippable: Food`).
  - **Inline Search Bar**: Move the item search input directly into the `BankTab` header row, positioned neatly between the `Select` (multi-select) button and the slot capacity counter (`{stocked.length}/{bank.maxSlots}`).
- **Target Files**:
  - [`src/ui/components/drawer/BankDrawer.jsx`](../../../src/ui/components/drawer/BankDrawer.jsx) (retire `InspectionPanel` mounting and `showsInspect`)
  - [`src/ui/components/drawer/BankTab.jsx`](../../../src/ui/components/drawer/BankTab.jsx) (`ItemTileBody` tooltip content, inline search bar in header)
  - [`src/config/registries/equipmentConstants.js`](../../../src/config/registries/equipmentConstants.js) (`categoryOfItem` / slot resolution)

---

### [DRAG-02] Fix Drag Ghost Flying From Screen Top-Left on Enemy and Flag Pickup
- **Area**: Drag & Drop / Visual Motion (`pickupFlight.js`, `DndKit.jsx`, `MatToken.jsx`, `FlagLayer.jsx`)
- **Current Behavior**:
  - When picking up and dragging an **enemy** or a **flag**, the drag ghost sprite flies into the cursor from `(0, 0)` (the top-left corner of the screen).
  - This visual glitch does not happen for regular tokens or quest boards.
  - **Root Cause**:
    - In [`pickupFlight.js`](../../../src/ui/dnd/pickupFlight.js#L24-L48), `state.rect` is read from `activeNodeRect` / `draggingNodeRect`.
    - Enemies use `transform: translate(${left}px, ${top}px)` with `left: 0, top: 0` (`walker = true` in `MatToken.jsx:312-315`), and flags use `SharedEntityDrag` / separate `Flag` shells.
    - When `activeNodeRect` is measured as `(0, 0)` or unmeasured, `offset` evaluates to `(cursorX, cursorY)`. `playPickupFlight` then animates the ghost from `-offset.x, -offset.y`, which is `cursor - cursor = (0, 0)` (the top-left corner of the window).
- **Desired Behavior**:
  - The carried ghost must smoothly pick up directly from where the enemy or flag stands on the mat without flying in from the top-left screen corner.
  - Ensure `pickupFlight.js` accurately reads the live bounding client rect of the source element (taking into account CSS transforms and board scaling) and guards against zero-rect / unmeasured fallbacks.
- **Target Files**:
  - [`src/ui/dnd/pickupFlight.js`](../../../src/ui/dnd/pickupFlight.js)
  - [`src/ui/dnd/DndKit.jsx`](../../../src/ui/dnd/DndKit.jsx) (`SharedEntityDrag`, `overlayModifiers`)
  - [`src/ui/components/board/MatToken.jsx`](../../../src/ui/components/board/MatToken.jsx) (`walker` box transform & `setArtRef`)
  - [`src/ui/components/board/FlagLayer.jsx`](../../../src/ui/components/board/FlagLayer.jsx) (`FlagBody` drag ref binding)

---

### [TOKEN-03] Remove Under-Token Move Marker Ring on Movable Tokens
- **Area**: Visual Styling / Playmat Tokens (`tailwind.css`, `FixedTokens.js`, `MatToken.jsx`)
- **Current Behavior**:
  - Movable tokens (tokens bought or built, and the Guild Hall) display a flat elliptical ring pseudo-element underneath their base (`[data-token-movable]::after` in `tailwind.css:512-523`, keyed on `showsMoveMarker` in `FixedTokens.js`).
  - This under-token ring creates visual clutter and is not needed.
- **Desired Behavior**:
  - Remove the under-token marker ring pseudo-element (`[data-token-movable]::after`) so movable tokens sit cleanly on the playmat ground without an extraneous base ring.
- **Target Files**:
  - [`src/tailwind.css`](../../../src/tailwind.css) (`[data-token-movable]::after`, lines 512-523)
  - [`src/systems/board/FixedTokens.js`](../../../src/systems/board/FixedTokens.js) (`showsMoveMarker`, lines 96-100)
  - [`src/ui/components/board/MatToken.jsx`](../../../src/ui/components/board/MatToken.jsx) (`data-token-movable`, line 533)
  - [`src/tests/FixedTokenPress.test.js`](../../../src/tests/FixedTokenPress.test.js)
---

### [FLAG-01] Flag Reach Radius Ring Pixel Styling & Base Radius Increase
- **Area**: Visual Styling & Board Mechanics / Playmat Flags (`FlagLayer.jsx`, `matTuning.js`, `Flags.js`, `FlagRules.test.js`)
- **Current Behavior**:
  - The flag reach radius indicator is currently rendered as an SVG `<circle>` in `FlagLayer.jsx:196-209`:
    ```jsx
    <circle
        key={heroId}
        data-flag-ring={heroId}
        cx={p.x}
        cy={p.y}
        r={radius}
        fill="none"
        stroke="rgb(251, 191, 36)"
        strokeOpacity={0.4}
        strokeWidth={1}
        strokeDasharray="6 5"
        vectorEffect="non-scaling-stroke"
    />
    ```
    At 1px stroke, 40% opacity, and dashed vector rendering, it is virtually invisible against the colored and textured playmat terrain.
  - The default base `flagRadius` defined in `src/config/matTuning.js:55-61` is `164` mat units. With a grid step size of 160 units, `164` only covers immediate orthogonal adjacent neighbors and fails to reach diagonal neighbors (at 226 units), creating an overly restrictive work radius where heroes cannot reach nearby workstations or resource nodes without strict micro-positioning.
- **Desired Behavior**:
  - **Pixelated / Chamfered Border Styling**:
    - Replace the faint vector dashed `<circle>` with crisp pixelated styling matching the game's chamfered pixel boxes (like `PixelFrame` / `ui-frame-chamfer` or a crisp-edged pixel-stepped SVG border/ring).
    - Give it high visual contrast (e.g. sharp gold/amber pixel border with dark pixel drop-shadow or contrasting backing, `shape-rendering="crispEdges"`, or a chamfered octagonal/box boundary) so players can clearly discern the flag's work zone at a glance.
  - **Base Flag Radius Increase**:
    - Increase the baseline flag radius in `src/config/matTuning.js` from `164` to a larger, more generous default (e.g. ~240u, which covers diagonal neighbors [226u] and ~1.5 tile steps, or ~280-320u for ~2 tile steps).
    - Update default tuning hints and related test assertions (e.g., `FlagRules.test.js`, `Nearby.test.js`, `ShippedBuild.test.js`) to reflect the new baseline.
- **Target Files**:
  - [`src/ui/components/board/FlagLayer.jsx`](../../../src/ui/components/board/FlagLayer.jsx) (reach ring rendering, lines 196-209)
  - [`src/config/matTuning.js`](../../../src/config/matTuning.js) (`flagRadius` default value & hint, lines 54-61)
  - [`src/systems/board/Flags.js`](../../../src/systems/board/Flags.js) (`flagRadius()` accessor)
  - [`src/tests/FlagRules.test.js`](../../../src/tests/FlagRules.test.js) & [`src/tests/Nearby.test.js`](../../../src/tests/Nearby.test.js)

---

### [SKILLS-01] Basic Skills Gameplay Loops & Lifecycle Architecture (Planning Agent Scope)
- **Area**: System & Game Design / Skill Mechanics & Node Lifecycles (`skillRegistry.js`, `Respawn.js`, `TimedChanges.js`, `BoardRunner.js`, `Charges.js`, `tokens.json`, `recipes.json`)
- **Current Behavior**:
  - Most non-combat skills currently behave as identical, monolithic progress-bar work timers (`cycleTimeMs` + inputs -> outputs + XP).
  - While underlying primitives exist in the engine ([`Respawn.js`](../../../src/systems/board/Respawn.js) with `refill` vs `regrow`, [`TimedChanges.js`](../../../src/systems/board/TimedChanges.js) for tick-based clocks, and [`Charges.js`](../../../src/systems/board/Charges.js)), the individual skills lack distinct gameplay identities, interactive rhythms, and state transitions.
  - The player's mental model sees every resource node and crafting station as essentially the same generic token with a circular progress dial.
- **Desired Behavior**:
  - Designate a **dedicated Planning Agent** to author a comprehensive Skill Gameplay Design Document & technical specification detailing distinct gameplay loops for each core Starting skill group.
  - Each skill group must have a distinct mechanical loop, visual lifecycle, and interaction model:
    1. **Forestry (Woodcutting - Organic Growth & Regrowth Cycle)**:
       - **Loop & States**: Sapling (growing timer, unharvestable) -> Mature Tree (harvestable with axe, multiple wood charges or single fell) -> Stump / Fallen Log -> Sapling respawn or replanting requirement.
       - **Gameplay Feel**: Dynamic board transformation; trees physically change appearance across life stages; clearing land reveals ground or allows tactical forest management.
    2. **Mining (Vein Exhaustion & Regeneration Loop)**:
       - **Loop & States**: Solid Ore Vein (active node, pickaxe required, finite charges of raw ores/gems) -> Depleted/Exhausted Vein (dormant cracked rock state, charges = 0, heroes skip it) -> Timed ore replenishment / vein regeneration -> Active Vein.
       - **Gameplay Feel**: Reliable, predictable periodic yield; simple and grounded; strategic clustering of veins around mining camps.
    3. **Fishing (Aquatic Schooling & Water Spot Dynamics)**:
       - **Loop & States**: Water tile / Fishing Hole (splashes/ripples, school density, rod/net + bait requirements) -> Active catch cycles yielding fresh fish, shellfish, sunken debris -> Calm/Fished-out spot (schools scatter or submerge) -> Ripples reappear elsewhere or after calm period.
       - **Gameplay Feel**: Patience, water adjacency, bait consumption, high variance / rare treasure catches.
    4. **Farming (Multi-Stage Agricultural Cycle)**:
       - **Loop & States**: Tilled Plot / Soil -> Sowing seeds/cuttings -> Growth & Tending stages (time + water/fertilizer inputs) -> Fully Ripened Crop (golden wheat, plump tubers, vegetables) -> Harvest yield -> Fallow plot / replanting.
       - **Gameplay Feel**: Planning and deliberate yield pacing; foundational food/fiber supply feeding Cooking, Crafting, and Alchemy.
    5. **Smithing (Multi-Step Metallurgy: Smelting & Forging)**:
       - **Loop & States**: Furnace (combining raw ores + fuel/coal into ingots/bars) -> Anvil (heating bars + hammer strikes into armor, weapons, and tools).
       - **Gameplay Feel**: Hefty, industrial, two-phase production chain; tangible gear upgrades.
    6. **Crafting (Fine Fabrication & Component Assembly)**:
       - **Loop & States**: Workbench, Loom, Leatherworking Rack. Converting timber into handles/planks, pelts into leather, fibers into cloth, and assembling utility gear, containers, and jewelry.
       - **Gameplay Feel**: The connective tissue of the economy; produces parts required by other trades.
    7. **Cooking (Sustenance & Ration Preparation)**:
       - **Loop & States**: Campfire, Stove, Cauldron. Raw fish, meats, and crops cooked into rations, hearty meals, and beverages that provide hero buffs, health recovery, and stamina/speed boosts.
       - **Gameplay Feel**: Essential hero maintenance; consumable throughput.
    8. **Alchemy (Reagent Brewing & Transmutation)**:
       - **Loop & States**: Alchemy Table, Still, Alembic. Foraged herbs, mushrooms, and creature essences brewed into healing potions, elixirs, and transmutation recipes.
       - **Gameplay Feel**: Experimental, high-tier consumables and magical reagents.
    9. **Construction (Structural Expansion & Site Erection)**:
       - **Loop & States**: Unbuilt Foundation -> Material delivery stage -> Hammering/building progress -> Finished Building (with durability, upkeep, and functional bonuses).
       - **Gameplay Feel**: Tangible base-building and territory advancement.
  - **Planning Scope Deliverables**:
    - Author a complete design specification document (e.g. `concept_skills_gameplay.md` / GDD update) detailing token state machines, sprite stage representations, tool requirements, cycle intervals, and respawn clocks for each skill.
    - Define clear hooks into [`BoardRunner.js`](../../../src/systems/board/BoardRunner.js), [`Respawn.js`](../../../src/systems/board/Respawn.js), [`TimedChanges.js`](../../../src/systems/board/TimedChanges.js), and [`Flags.js`](../../../src/systems/board/Flags.js) so heroes naturally respect node states (skipping depleted veins or growing saplings, focusing on ready targets).
- **Target Files & System References**:
  - [`src/config/registries/skillRegistry.js`](../../../src/config/registries/skillRegistry.js)
  - [`src/systems/board/Respawn.js`](../../../src/systems/board/Respawn.js) & [`src/systems/board/TimedChanges.js`](../../../src/systems/board/TimedChanges.js)
  - [`src/systems/board/BoardRunner.js`](../../../src/systems/board/BoardRunner.js) & [`src/systems/board/Charges.js`](../../../src/systems/board/Charges.js)
  - `data/tokens.json`, `data/recipes.json`
  - Design references: [`docs/reference/GDD.md`](../../../docs/reference/GDD.md)

---

### [COMBAT-02] Combat Consumables System & Activation Feedback
- **Area**: Combat Systems, Consumables & Visual Feedback (`ConsumptionSystem.js`, `BoardCombat.js`, `items.json`, `HeroBubbleLayer.jsx`, `TokenBubbles.jsx`)
- **Current Behavior**:
  - `ConsumptionSystem.js` currently only checks HP thresholds to eat food or drink beverages for out-of-combat/post-damage healing.
  - The general `consumeLoopConsumables` function is completely dormant with no callers outside unit tests.
  - There is no trigger for combat consumables (e.g. drinking an attack/speed/armor elixir when combat engages, or popping a potion in response to combat events).
  - When an item is consumed, there is no distinct visual feedback, toast, or floating bubble over the hero showing that the item was activated.
- **Desired Behavior**:
  - **Combat Activation Triggers**:
    - Connect consumable consumption into combat lifecycle hooks (e.g. auto-drinking an equipped combat potion/elixir upon fight start in `BoardCombat.startFight`, or triggering emergency health potions when HP drops critically in combat).
  - **Authored Test Consumables**:
    - Create a suite of functional test consumables in `data/items.json`:
      - e.g. *Minor Health Potion* (restores immediate HP when below critical threshold in battle).
      - e.g. *Combat Elixir / Elixir of Valor* (consumed at fight start; grants temporary bonus damage, attack speed, or armor for the duration of the encounter).
  - **Visual Activation Feedback (Floating Bubble)**:
    - When a consumable triggers, spawn a clear floating pop-up bubble / badge directly over the hero (or between hero and enemy) displaying the item sprite/icon and an activation confirmation (e.g. `[Potion Icon] +Elixir of Valor Active!` or `[Potion Icon] +45 HP`).
- **Target Files**:
  - [`src/systems/hero/ConsumptionSystem.js`](../../../src/systems/hero/ConsumptionSystem.js) (combat hooks & potion logic)
  - [`src/systems/board/BoardCombat.js`](../../../src/systems/board/BoardCombat.js) (`startFight` consumable check & trigger)
  - `data/items.json` (authored test potion/elixir items)
  - [`src/ui/components/board/HeroBubbleLayer.jsx`](../../../src/ui/components/board/HeroBubbleLayer.jsx) & [`src/ui/components/board/heroBubbles.js`](../../../src/ui/components/board/heroBubbles.js) (floating activation bubble)
  - [`src/tests/ConsumptionSystem.test.js`](../../../src/tests/ConsumptionSystem.test.js)

---

### [COMBAT-03] Combat UI Overhaul (Post-Combat System Phase)
- **Area**: Combat Visuals, HUD & Combat Feedback (`BoardCombat.js`, `TokenBubbles.jsx`, `MatToken.jsx`, `HeroDockCard.jsx`)
- **Sequencing & Dependency Constraint**:
  - **Scheduled Phase**: This overhaul should explicitly be executed **after** the core combat engine overhaul ([`[COMBAT-01]`](#combat-01-combat-system-overhaul--deep-dive-specification-planning-agent-scope)) and consumables ([`[COMBAT-02]`](#combat-02-combat-consumables-system--activation-feedback)) are developed, so the exact state, telemetry, and metrics to display are known.
- **Desired Behavior**:
  - Overhaul the in-game combat presentation on the playmat:
    1. **Dual Health & Resource Bars**: Clear, prominent HP bars for both hero and enemy with smooth damage interpolation.
    2. **Active Status & Buff Icons**: Clean status badges showing active potion buffs, bleeds, burns, poison ticks, and shield values.
    3. **Floating Combat Feedback**: High-contrast, crisp pixelated floating combat text (hits, crits, misses, blocks, heals, consumable activation).
    4. **Tactical Engagement Styling**: Clear visual line/indicator connecting fighting hero and target enemy.
- **Target Files**:
  - [`src/ui/components/board/TokenBubbles.jsx`](../../../src/ui/components/board/TokenBubbles.jsx)
  - [`src/ui/components/board/MatToken.jsx`](../../../src/ui/components/board/MatToken.jsx)
  - [`src/ui/components/board/AnimatedEnemySprite.jsx`](../../../src/ui/components/board/AnimatedEnemySprite.jsx)
  - [`src/ui/components/dock/HeroDockCard.jsx`](../../../src/ui/components/dock/HeroDockCard.jsx)

---

### [EQUIP-01] Distinct Physical Ownership for Gear/Tools vs Shared Consumables
- **Area**: Equipment & Inventory Systems (`EquipmentManager.js`, `EquipmentValidator.js`, `InventoryManager.js`, `equipmentCategories.js`, `DockEquipmentGrid.jsx`)
- **Current Behavior**:
  - In [`EquipmentManager.js:66`](../../../src/systems/equipment/EquipmentManager.js#L66), `equipItem` only validates `InventoryManager.hasItem(itemId, 1)`.
  - It does not deduct the item from the Bank, nor does it track how many copies of `itemId` are already equipped across the rest of the guild roster.
  - Consequently, owning a single `Bronze Pickaxe` in the Guild Bank allows all 8 heroes to equip that exact same pickaxe at the same time.
  - While consumables (food/drink/potions) are intended to draw and spend from a shared bank pool, tools, weapons, and wearable gear (`CATEGORY_KINDS.GEAR`) represent distinct physical items.
- **Desired Behavior**:
  - **1-to-1 Gear & Tool Ownership**:
    - Every equipped piece of gear, weapon, or gathering tool must correspond to a distinct physical copy.
    - Equipping all 8 heroes with pickaxes requires crafting or purchasing 8 separate pickaxes. If the guild only owns 1 pickaxe, only 1 hero can equip and use it at any given time.
  - **Architecture & Implementation Requirements**:
    - **Stock Reservation / Move-to-Hero**:
      - Differentiate `CATEGORY_KINDS.GEAR` from `CATEGORY_KINDS.SUSTENANCE` and `CATEGORY_KINDS.CONSUMABLE`.
      - When checking whether a hero can equip a gear item (`EquipmentValidator.canHeroEquip`), calculate available unequipped stock: `availableStock = totalOwned - countEquippedAcrossAllOtherHeroes(itemId)`.
      - Block equipping if `availableStock <= 0` with a clear refusal reason (e.g. `"All owned Bronze Pickaxes are already in use"`).
      - Alternatively, physically move the item from the Guild Bank into the hero's carried inventory upon equip, and return it to the Bank upon unequip.
    - **Consumable Distinction Preserved**:
      - Food, drink, and potions continue using the shared pool model, where multiple heroes can link to the bank stack and consume units as needed.
  - **Target Files**:
    - [`src/systems/equipment/EquipmentManager.js`](../../../src/systems/equipment/EquipmentManager.js) (`equipItem`, `unequipItem`, `syncEquipmentModifiers`)
    - [`src/systems/equipment/EquipmentValidator.js`](../../../src/systems/equipment/EquipmentValidator.js) (`canHeroEquip`)
    - [`src/config/registries/equipmentCategories.js`](../../../src/config/registries/equipmentCategories.js) (`CATEGORY_KINDS`)
    - [`src/ui/components/dock/DockEquipmentGrid.jsx`](../../../src/ui/components/dock/DockEquipmentGrid.jsx)
    - [`src/ui/components/drawer/BankTab.jsx`](../../../src/ui/components/drawer/BankTab.jsx) (show in-use / available count)
    - [`src/tests/EquipmentManager.test.js`](../../../src/tests/EquipmentManager.test.js)

---

### [QUEST-01] Remove Quest Done Glow and Tutorial Guide Glowing Circles
- **Area**: Visual Styling & HUD Clutter / Quests & Tutorial (`MatToken.jsx`, `TutorialAideOverlay.jsx`, `ReactRoot.jsx`, `tailwind.css`)
- **Current Behavior**:
  - Completed quests on the playmat display a prominent breathing gold radial gradient halo behind their art (`gi-quest-ready` in `MatToken.jsx:548-555` and `tailwind.css:446-466`).
  - Active tutorial steps project large, pulsing neon yellow glowing beacon rings with heavy CSS drop shadows (`TutorialAideOverlay.jsx:231-258`) over target UI elements and board tokens.
  - Both effects look blurry, heavy, and completely out of place against the game's crisp pixel art aesthetic. Furthermore, tutorialization is slated for a complete directional redesign in a future phase.
- **Desired Behavior**:
  - **Remove Tutorial Guide Glowing Circles**:
    - Unmount and remove `<TutorialAideOverlay />` from [`ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx#L197).
    - Remove the tutorial beacon hooks and `setTutorialAideTarget` calls in [`MatToken.jsx:276-284`](../../../src/ui/components/board/MatToken.jsx#L276-L284).
    - Retire or delete [`TutorialAideOverlay.jsx`](../../../src/ui/components/base/TutorialAideOverlay.jsx) and its associated CSS z-indices.
  - **Remove Quest Done Glow**:
    - Remove the `data-quest-glow` element (`<div className="gi-quest-ready ..."/>`) from [`MatToken.jsx:548-555`](../../../src/ui/components/board/MatToken.jsx#L548-L555).
    - Remove the `@keyframes gi-quest-ready` and `.gi-quest-ready` CSS declarations from [`tailwind.css:446-466`](../../../src/tailwind.css#L446-L466).
    - If completion feedback is needed, rely solely on clean pixelated badges (or the existing "Click to claim" tooltip state) without blurred radial glows.
- **Target Files**:
  - [`src/ui/ReactRoot.jsx`](../../../src/ui/ReactRoot.jsx) (lines 40, 197)
  - [`src/ui/components/base/TutorialAideOverlay.jsx`](../../../src/ui/components/base/TutorialAideOverlay.jsx)
  - [`src/ui/components/board/MatToken.jsx`](../../../src/ui/components/board/MatToken.jsx) (lines 38, 276-284, 548-555)
  - [`src/tailwind.css`](../../../src/tailwind.css) (`.gi-quest-ready`, lines 446-466)
  - [`src/tests/MatPixelLayers.test.js`](../../../src/tests/MatPixelLayers.test.js) (drop `.gi-quest-ready` expectation)

---

### [DOCK-02] Horizontal Hero Bar Rework: Left-Facing Dynamic Sprite Portraits & Name Only
- **Area**: UI & UX / Hero Dock & Bank Hero Selection (`BottomHeroDock.jsx`, `DockHeroFigure.jsx`, `HeroDockTab.jsx`, `AnimatedHeroSprite.jsx`, `AssetManager.js`)
- **Current Behavior**:
  - The hero bar/dock (used when viewing heroes and equipping gear alongside the bank) carries visual clutter (HP bars, status text, layered frames).
  - All heroes currently fall back to the exact same static recruit portrait (`hn_recruit_icon_por` / `hn_recruit_por`), so fighters, wizards, rangers, and rogues look identical.
  - The portraits are oriented facing toward the right.
- **Desired Behavior**:
  - **Streamlined Presentation (Portrait & Name Only)**:
    - Rework the hero bar item layout to display cleanly: **hero portrait + hero name**.
    - Strip away unnecessary elements (HP bars, redundant status text, bulky frames) for a clean, cohesive look.
  - **Left-Facing Direction**:
    - Ensure the hero portrait faces toward the **left** side (using `facingLeft={true}` in [`AnimatedHeroSprite.jsx`](../../../src/ui/components/board/AnimatedHeroSprite.jsx#L35) or CSS `transform: scaleX(-1)`), creating a natural orientation looking into the active UI and playmat.
  - **Dynamic Headshot Cropping from Animation Sprite Sheets**:
    - Instead of requiring separate static portrait files or repeating the recruit portrait, derive each hero's portrait directly from their class animation sprite sheet (`hn_recruit_sheet`, `hn_fighter_sheet`, `hn_rogue_sheet`, `hn_wizard_sheet`, `hn_ranger_sheet`, etc., resolved via `resolveAnimationPath` in [`AssetManager.js:60-72`](../../../src/utils/AssetManager.js#L60-L72)).
    - Crop / zoom the portrait frame to target the hero's head and upper torso (top half of the 64x64 idle sprite frame, row index 2, col 0) where character heads are consistently positioned. This immediately gives each hero class a unique, animated or crisp pixel headshot matching their true sprite.
- **Target Files**:
  - [`src/ui/components/dock/DockHeroFigure.jsx`](../../../src/ui/components/dock/DockHeroFigure.jsx)
  - [`src/ui/components/dock/BottomHeroDock.jsx`](../../../src/ui/components/dock/BottomHeroDock.jsx)
  - [`src/ui/components/dock/HeroDockTab.jsx`](../../../src/ui/components/dock/HeroDockTab.jsx)
  - [`src/ui/components/board/AnimatedHeroSprite.jsx`](../../../src/ui/components/board/AnimatedHeroSprite.jsx) (`facingLeft` prop, lines 35, 96, 126)
  - [`src/utils/AssetManager.js`](../../../src/utils/AssetManager.js) (`ANIMATION_MAP`, lines 60-72)

