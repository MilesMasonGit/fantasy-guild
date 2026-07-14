# Post-Rework Cleanup & Fine-Tuning Task List

This is a centralized living document tracking the remaining details, adjustments, and fixes needed following the major gameplay and systems rework.

## Active Progress Summary
- **Total Tasks**: 27
- **Completed**: 0
- **Remaining**: 27

---

## 1. Combat & Character Stats
*Focuses on math, balance, combat formulas, combat execution, and hero attributes.*

- [ ] **Split Progress Bars for Combat**
  - **Description**: Rebuild the active combat progress indicators so combat actions are transparent. Instead of a single generic task-cycle progress bar, combat requires dual split progress bars showing the Hero's attack cooldown/speed and the Enemy's attack cooldown/speed.
  - **Details**: This visually represents the "Speed" stat dynamically, showing who will strike next.
  - **Key Execution Steps**:
    1. Update the combat card slot renderer in `src/ui/components/banner/AreaBannerRow.jsx` to render dual horizontal tracks when a combat encounter is active.
    2. Extract remaining time/tick stats from the combat state in `src/systems/combat/CombatSystem.js` and pipe them to the progress bar.
- [ ] **Rebuild Combat Cards**
  - **Description**: Redesign the visual representation and template structures of Combat Cards to fully support the new 7-stat combat engine (HP, Armor, Block, Damage, Accuracy, Crit, Speed).
  - **Details**: These cards must display enemy vitals, base stats, and reward details clearly on the card face.
  - **Key Execution Steps**:
    1. Modify combat card templates to contain structured object mappings for all 7 combat stats.
    2. Refactor `src/ui/components/ActiveCardFace.jsx` (combat rendering case) to present these stats as a clean, retro-styled stat block with matching mini-icons.
- [ ] **Status Effect Visuals & Sprites**
  - **Description**: Design and display visual status indicators (debuff/buff icons) directly on running loops, combat encounters, and hero frames.
  - **Details**: Visual icons for effects like Poison, Bleed, Regeneration, Stun, and Haste should overlay on hero portraits and enemy cards, along with duration or stack counts.
  - **Key Execution Steps**:
    1. Create status effect display containers inside `RowHeroCard` and `ActiveCardFace` (combat overlay).
    2. Add standard styling hooks for active status effects so changes in the state reflect immediately.

---

## 2. Skill Mapping & Progression
*Focuses on skill implementation, scaling, and character/guild progression.*

- [ ] **Basic Upgrade Tree**
  - **Description**: Design and wire the complete Guild Hall upgrades system, replacing placeholders with actual game limit adjustments.
  - **Details**: Upgrades should purchase increased Roster Size, Bank Tabs, Bank Slot capacities, and passive bonuses.
  - **Key Execution Steps**:
    1. Expand `src/config/guildUpgrades.js` with structured levels, costs, and effects.
    2. Build tree rendering logic in `src/ui/components/fullscreen/GuildHallScreen.jsx` to display dependency lines and purchase logic.
- [ ] **Recruitment Rework & Migration to Guild Upgrades**
  - **Description**: Move the hero recruitment mechanic from the Heroes drawer pane to a dedicated upgrades panel inside the Guild Hall.
  - **Details**: This aligns recruitment with guild progression, gating candidate generation and recruitment costs behind Guild Hall progression.
  - **Key Execution Steps**:
    1. Extract recruitment sub-components from the general bottom drawer.
    2. Embed the Recruitment Center UI directly into `GuildHallScreen.jsx`, verifying that costs scale correctly and check against maximum roster limits.
- [ ] **Bank Tabs Expansion**
  - **Description**: Implement upgrade-purchasable bank tabs, allowing players to scale storage space dynamically.
  - **Details**: Tabs beyond the first starting tab should be locked behind upgrade paths in the Guild Hall.
  - **Key Execution Steps**:
    1. Bind `inventory.maxTabs` state to the Bank Tab upgrade levels.
    2. Add a locked state or unlock-hint overlays to the tab creation button (`+`) in the Bank drawer.
- [ ] **Quest Completion & Unlocking Areas**
  - **Description**: Enable manual or automatic turn-in of unlock quests to unlock locked area sets on the playmat.
  - **Details**: Once a locked area's map fragment requirements (unlock quests) are satisfied, the player should trigger the unlock sequence to activate that area's banner row.
  - **Key Execution Steps**:
    1. Create unlock UI overlay triggers on locked area mat strips in `AreaBannerContainer.jsx`.
    2. Connect completion events to `QuestTracker.completeUnlockQuestManual()`, consuming items and updating the collection state.
- [ ] **Quest Respawning Mechanics & Refresh Timers**
  - **Description**: Create a system for quests to spawn periodically in active areas, replacing completed ones.
  - **Details**: A quest refresh timer or loop-cooldown clock should govern when new quests are generated or offered to the area.
  - **Key Execution Steps**:
    1. Store a quest cooldown state in the area state object.
    2. Add spawning logic inside `LoopRunner.js` to draw a quest card when the cooldown expires.

---

## 3. UI, HUD & Visual Polish
*Focuses on aesthetics, layout spacing, responsiveness, card styling, and tooltips.*

- [ ] **Card Sizing & Design in the Card Binder**
  - **Description**: Rebuild the layout and sizing of cards in the Card Binder tab to use the standard responsive card dimensions.
  - **Details**: Cards should render at the small tier (128px) while showing card art, name, and ownership count indicators.
  - **Key Execution Steps**:
    1. Refactor `BinderCardTile.jsx` to leverage the standard `GICard` component at the `sm` tier.
    2. Ensure grid cells resize dynamically without breaking card geometry.
- [ ] **Flickering on Cards in Binder**
  - **Description**: Fix visual flickering or blank flashes that occur when searching, filtering, or scrolling in the Card Binder drawer.
  - **Details**: Often caused by constant image reloading or heavy component unmounting during state changes.
  - **Key Execution Steps**:
    1. Implement React memoization on binder card tiles.
    2. Ensure stable, unique React keys are assigned based on card database template IDs.
- [ ] **Card Binder: Hide Unobtained Cards**
  - **Description**: Update the binder index so cards that the player has not yet unlocked are hidden from normal view.
  - **Details**: Helps maintain a sense of progression and mystery; unobtained cards can either be hidden or rendered as silhouettes.
  - **Key Execution Steps**:
    1. Filter out unobtained items during binder catalog data retrieval in `CollectionBinderModal.jsx`.
    2. Add a greyed-out or silhouette style fallback for cards that should be shown as locked rather than hidden.
- [ ] **Rebuild Hero Tab**
  - **Description**: Re-style the Hero tab in the bottom drawer to match the split-pane glassmorphism aesthetic.
  - **Details**: Include slots for weapons, armor, food, and drink, with quick unequip interactions.
  - **Key Execution Steps**:
    1. Redesign `src/ui/components/drawer/HeroesTab.jsx` to show cards and gear slots in a side-by-side split layout.
    2. Bind click handlers to trigger item unassignment and return them to the Bank inventory.
- [ ] **Rebuild Pack Opening**
  - **Description**: Polish the pack purchasing and card reveal overlay to integrate with the updated 220x256 card frame sizing.
  - **Details**: Optimize layouts for the reveal screen container and add crisp card-flip animations.
  - **Key Execution Steps**:
    1. Recalculate margins and spacing inside `PackOpeningOverlay.jsx` to use the large card tier (512px) cleanly.
    2. Implement standard CSS 3D transforms for a tactile "card flip" interaction.
- [ ] **UX Experience: Drag-and-Dropping Cards**
  - **Description**: Refine the visual indicators and feedback when dragging cards onto the playmat or deck slots.
  - **Details**: Slots should highlight when hovering valid card types over them, and the cursor should display a clear drag preview.
  - **Key Execution Steps**:
    1. Bind active class changes to dragover and dragleave events in `DeckFocusRow`.
    2. Create clear styling hooks for "invalid drop target" vs "valid drop target" highlights.
- [ ] **Link All Drag & Drop (Equipment to Heroes, Consumables to Cards)**
  - **Description**: Fully connect drag interactions across the user interface.
  - **Details**: Allow items to be dragged from the Bank drawer pane directly onto hero slots to equip them, and consumables onto card slots or hero frames.
  - **Key Execution Steps**:
    1. Configure HTML5 draggable attributes on inventory item icons in the Bank panel.
    2. Add drop listeners on the Hero card portrait and equipment slots to execute `EquipmentManager.equipItem()`.
- [ ] **Card Movement Animations for Deck/Area Banner**
  - **Description**: Create smooth transition animations for cards as they shift positions along the Area Banner loop.
  - **Details**: Cards moving from Upcoming to Active, or getting shuffled back into the Deck, should slide or fade instead of snapping.
  - **Key Execution Steps**:
    1. Set up horizontal translate classes on active card trackers.
    2. Trigger animations via transition states in `AreaBannerRow.jsx`.
- [ ] **Improve Progress Bar**
  - **Description**: Refine the design of the progress bar in the banner headers to offer high visual feedback.
  - **Details**: Add skill-themed gradient color matches (e.g., green for gathering, red for combat) and text readouts showing remaining times.
  - **Key Execution Steps**:
    1. Update progress bar rendering in `src/ui/components/ActiveCard.jsx` or progress trackers.
    2. Add visual blooms or glossy gloss overlay variants.
- [ ] **Sprite Work for Main Bar**
  - **Description**: Integrate final retro-styled pixel art sprites for the navigation bubble buttons, gold display, and status buttons.
  - **Details**: Replaces styled CSS circles with structured pixel artwork indicators.
  - **Key Execution Steps**:
    1. Map custom image URLs or inline SVG sprite paths to buttons in `nav/BubbleMenu.jsx`.
- [ ] **Banner UI, Info Panels, & Controls**
  - **Description**: Standardize and restyle the Info and Control panels in the Area Banner rows to match the new tall mat baseline.
  - **Details**: Bring the panels in line with the 354px height profile, adding live activity logs to record loop steps.
  - **Key Execution Steps**:
    1. Restyle panels in `AreaBannerRow.jsx` to stretch vertically across the mat.
    2. Integrate the per-area live text log into the Info panel.
- [ ] **Rework Recipe Cards**
  - **Description**: Redesign recipe displays in the Outpost view/Recipe Focus to have a clean, visual-first grid.
  - **Details**: Replace ingredient lists with item icons and green/red progress bars checking bank reserves.
  - **Key Execution Steps**:
    1. Create recipe card layouts in `StationFocusRow.jsx`.
    2. Bind hover tooltips to ingredient icons.

---

## 4. Systems, Economy & Data Tuning
*Focuses on resource drops, item metadata, quest configurations, and shop/pack mechanics.*

- [ ] **Backdrop Sprites for Item Icons**
  - **Description**: Apply textured, color-coded backdrop panels to item icons to designate categories or item rarities.
  - **Details**: For example, raw materials get wood/stone frames, rare items get golden glowing cells, and equipment gets a grid background.
  - **Key Execution Steps**:
    1. Modify `src/ui/components/base/ItemIcon.jsx` to read category traits from the item registry.
    2. Add corresponding background sprite assets or CSS filters.
- [ ] **Backgrounds for Area Deck & Consumables**
  - **Description**: Map high-fidelity, native 256px scene backdrops and frame styles for all new game areas and consumable items.
  - **Details**: Author and configure scenic backgrounds for Whispering Woods, Misty Mountains, and Sunken Bog.
  - **Key Execution Steps**:
    1. Configure background files in `AreaMat.jsx` with pixelated scaling hooks.
- [ ] **Loading in Images Correctly**
  - **Description**: Audit all graphic pathways to ensure images load cleanly across build profiles without paths breaking.
  - **Details**: Standardize file referencing paths to maintain validity in local dev servers, static production builds, and packaged app configurations.
  - **Key Execution Steps**:
    1. Audit image reference assets in config registries.
    2. Implement generic fallback image error triggers on elements.

---

## 5. Under-the-Hood & Stability
*Focuses on logging noise, console warnings, error handling, performance, and code quality.*

- [ ] **Tauri Migration & Packaging**
  - **Description**: Wrap the web application in a Tauri native shell for desktop distribution.
  - **Details**: Set up configuration schemas, rust crates, and build pipelines targeting executable binaries for Steam distribution.
  - **Key Execution Steps**:
    1. Run `cargo tauri init` inside the workspace directory.
    2. Configure windows sizes, performance flags, and asset bundles inside `src-tauri/tauri.conf.json`.
- [ ] **Notification Rebuild**
  - **Description**: Rewrite the game-wide notification engine to avoid screen clutter.
  - **Details**: Redirect frequent notifications (like resource gains and low-level loop ticks) to localized Area Activity Logs, keeping global toasts reserved for critical alerts (e.g., deaths, level ups).
  - **Key Execution Steps**:
    1. Create a filter threshold inside `NotificationSystem.js`.
    2. Route lower-priority updates to local store arrays instead of DOM overlays.
- [ ] **Animation for Heroes**
  - **Description**: Implement frame-by-frame pixel art animations for heroes active in loop cycles.
  - **Details**: Support idle, working, and combat attack states using high-resolution spritesheets.
  - **Key Execution Steps**:
    1. Define keyframe animation maps in CSS for each class.
    2. Swap animation classes based on the current loop cell state (e.g., active card type).
- [ ] **Animation for Hero Backdrops**
  - **Description**: Add subtle parallax or ambient particle movement to hero background mats.
  - **Details**: Adds visual depth behind the hero portrait in the banner row and focus views.
  - **Key Execution Steps**:
    1. Apply smooth CSS animations (e.g., panning backgrounds or floating embers) to `RowHeroCard` structures.
