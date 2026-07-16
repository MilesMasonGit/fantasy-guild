# Post-Rework Cleanup & Fine-Tuning Task List

This is a centralized living document tracking the remaining details, adjustments, and fixes needed following the major gameplay and systems rework.

Tasks are ordered by execution priority: foundations first, then work that builds on the fresh combat engine, then progression systems, then visual polish in batches by code area. Sprite-dependent tasks are parked in Group 7 until art assets are ready; packaging comes last.

## Active Progress Summary
- **Total Tasks**: 27
- **Completed**: 15
- **Remaining**: 12

---

## Group 1 — Foundations
*Plumbing that later tasks depend on. Do these first.*

- [x] **Loading in Images Correctly** *(completed 2026-07-14)*
  - **Description**: Eliminate the sprite pop-in delay at game start — art should appear instantly.
  - **What was done**: Added a boot-time asset preloader (`src/systems/core/AssetPreloader.js`) fed by an auto-generated image manifest (vite plugin in `vite.config.js`). First paint is gated on first-screen art (playmat/backgrounds/heroes, ~270ms) behind a minimal splash in `index.html`; remaining art warms in the background during the save-slot screen. Also moved the 182MB `public/assets/dataset/` art-pipeline folder to `raw_assets/dataset/` so it no longer ships in production builds.
- [x] **Notification Rebuild** *(completed 2026-07-14 — re-scoped)*
  - **Description**: Reduce the screen space notifications consume, without changing their content.
  - **What was done**: Compacted toast ribbons (shorter height, smaller text, tighter gaps), pinned the toast stack to the true bottom-center of the screen (viewport-fixed, so open drawers no longer push it up), changed the default position setting to bottom-center with a one-time migration off the old top-right default, and added a "Hide" button next to "Clear All" that collapses the ribbons (crisis alerts still punch through while hidden).
  - **Deferred by owner decision**: routing low-priority notifications into per-area Activity Logs waits until the logs have a visible home — folded into the Group 6 "Banner UI, Info Panels, & Controls" task.

---

## Group 2 — Combat Presentation
*Builds directly on the freshly landed 7-stat combat engine and status effects system.*

- [x] **Split Progress Bars for Combat** *(completed 2026-07-14)*
  - **Description**: Dual attack-loop bars during combat — one per combatant — plus a universal hero progress bar.
  - **What was done** (owner design 2026-07-14): The banner progress bar moved from above the active card to **above the hero card** and is now the universal display for every hero state — drawing, shuffling, task work, and (in combat) the hero's attack loop, with its cycle-time readout. A second red bar appears **above the enemy (combat) card** during fights showing the enemy's attack loop and speed. LoopRunner publishes both percents on the same throttled `area:progress` event (`_publishCombatProgress`); draw/shuffle phases now animate the bar too (they previously never published progress). Enemy attack speed is persisted to `card.combat.enemyAttackSpeed` for the UI.
- [ ] **Improve Progress Bar**
  - **Description**: Refine the design of the progress bar in the banner headers to offer high visual feedback.
  - **Details**: Add skill-themed gradient color matches (e.g., green for gathering, red for combat) and text readouts showing remaining times.
  - **Key Execution Steps**:
    1. Update progress bar rendering in `src/ui/components/ActiveCard.jsx` or progress trackers.
    2. Add visual blooms or glossy gloss overlay variants.
  - **Note**: Batched with Split Progress Bars — same component territory.
- [x] **Rebuild Combat Cards** *(completed 2026-07-14 — design evolved)*
  - **Description**: Split combat theatre — the combat card carries only the enemy; stats live on the info panels.
  - **What was done** (owner design 2026-07-14): Combat stats moved to the aligned info panels (see previous task) rather than onto the card face. The card face is now `EnemyStage.jsx`: enemy avatar (lunging toward the hero on attack, rattling when struck), name, and traits — the redundant hero group, HP/EN bars, and attack-cycle modules were removed. The combat animation split in two via a shared `useCombatFeedback` hook + `DamageFloaters` (`combatFeedback.jsx`): the hero now animates on the Hero card (lunge right on attack, rattle + damage floater when hit), the enemy on the combat card. Legacy playmat (flag off) keeps the original full `CombatStage`.
- [ ] **Status Effect Visuals & Sprites**
  - **Description**: Design and display visual status indicators (debuff/buff icons) directly on running loops, combat encounters, and hero frames.
  - **Details**: Visual icons for effects like Poison, Bleed, Regeneration, Stun, and Haste should overlay on hero portraits and enemy cards, along with duration or stack counts.
  - **Key Execution Steps**:
    1. Create status effect display containers inside `RowHeroCard` and `ActiveCardFace` (combat overlay).
    2. Add standard styling hooks for active status effects so changes in the state reflect immediately.
  - **Note**: Structure and placement now with placeholder icons (`StatusPlacards.jsx` already started); final sprites swap in during Group 7.

---

## Group 3 — Guild Hall Progression Chain
*Strict dependency order: the upgrade tree must exist before the things gated behind it.*

- [x] **Basic Upgrade Tree** *(closed 2026-07-14 — owner accepted current state)*
  - The Guild Hall upgrade list (Bank Tabs, Bank Slots, Stack Size, Roster Size; gold costs, rank pips) landed during the UI overhaul (Phase 4) and the owner is happy with it as-is. Revisit only if progression tuning demands it.
- [x] **Bank Tabs Expansion** *(closed 2026-07-14 — verified already implemented, then redesigned same day)*
  - Original wiring (upgrade-bound caps, locked `+`) verified; then reworked to the owner's fixed-tab design: bank tabs are system-owned — 5 free + 15 via Guild Hall = 20 total, always visible in the strip (locked ones greyed with a lock). Tabs render as 32px sprites of their first item (slot number when empty); no player create/rename/delete. Added a Select mode (multi-select stacks; drag any selected tile to move the whole selection onto a tab) and bulk selling behind a confirmation modal that lists every stack with its gold value. The binder's TabStrip keeps the old behavior.
- [x] **Recruitment Rework & Migration to Guild Upgrades** *(closed 2026-07-14 — verified already implemented)*
  - `RecruitmentSection` lives in `GuildHallScreen.jsx` (migrated in overhaul Phase 4); the Heroes drawer has no recruitment UI. Verified live: roll candidates → hire spends Influence at the scaled cost → hero joins the roster → other candidates dismissed. Fixed a stale empty-roster hint that still pointed "below" instead of at the Guild Hall.

---

## Group 4 — Quest Loop
*Natural pair: unlocking areas via quests, then keeping quests flowing.*

- [x] **Quest Completion & Unlocking Areas** *(completed 2026-07-14 — Quest System v2)*
- [x] **Quest Respawning Mechanics & Refresh Timers** *(completed 2026-07-14 — Quest System v2)*
  - Both tasks were superseded by the owner-designed Quest System v2 — see `quest_system_concept.md` (the source of truth). Shipped: per-locked-area quest boards (3 slots, +`quest_slots` Guild Hall upgrade to 12), Main Story Quests occupying slots first (authored `unlockQuestIds`; incl. the tutorial action quest "Deploy a Hero"), procedural gather/defeat quests generated from unlocked areas' card pools, gold + bonus-item rewards, per-area unlock progress bars (fragments retired; thresholds 20/30/40 ⚠ placeholder), global 5-minute refresh clock (`questConfig.js`), and the Quest Control Bar (countdown, Abandon All, scaling-cost Refresh Now). Smoke-tested end to end 2026-07-14.

---

## Group 5 — Binder & Drawer Polish
*Same component clusters — batch to avoid revisiting files.*

- [x] **Card Sizing & Design in the Card Binder** *(completed 2026-07-14)*
- [x] **Flickering on Cards in Binder** *(completed 2026-07-14)*
- [x] **Card Binder: Hide Unobtained Cards** *(completed 2026-07-14 — design evolved)*
  - Binder tiles rebuilt on the standard GICard `sm` frame (art, name, ownership pips + n/4, deployment badge), memoized on display fields with stable keys — verified the DOM node survives search filtering (no remount, no image flash). Owner design: the binder is STORAGE, not an index — it lists only owned cards (no silhouettes); progress totals still count against the obtainable catalog.
- [x] **Rebuild Hero Tab** *(completed 2026-07-14 — design evolved)*
  - Heroes moved OUT of the bottom drawer entirely into `HeroSideDrawer.jsx`: a full-height glassmorphism drawer off the bubble bar's side (follows the menu-side setting). Split-pane: roster + bench list (tiles drag onto area hero slots) ←→ selected hero sheet with portrait, HP/EN, the four gear slots (weapon/armor/food/drink; click to unequip, drop items to equip), bench/roster moves, and notable skills. `ui:open_drawer {tab:'heroes'}` and hero-customize events route here; the bottom drawer now holds Cards + Bank only.
- [x] **Rebuild Pack Opening** *(completed 2026-07-14)*
  - Cards deal face-down and 3D-flip on click (placeholder woven card back until Group 7 sprites); badge + Claim appear on reveal; `ui.instantPackReveal` setting (Settings → Gameplay) skips the ceremony. Fixed a real bug: duplicate templates in one pack shared React state via templateId keys (one flip revealed all copies). Track spacing tightened to the lg tier.
- [x] **Rework Recipe Cards** *(completed 2026-07-14)*
  - `RecipeCard` in the Station focus: output icon + name header, each ingredient as an icon with a green/red bank-reserve bar driven by live inventory counts, hover tooltip (`Oak Wood: 3/2 in bank`), level/time footer. Normalizes content inputs that carry `id` instead of `itemId`.

---

## Group 6 — Interaction & Motion Polish
*Drag-and-drop as one continuous effort, then animation and banner-panel work.*

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
- [ ] **Banner UI, Info Panels, & Controls**
  - **Description**: Standardize and restyle the Info and Control panels in the Area Banner rows to match the new tall mat baseline.
  - **Details**: Bring the panels in line with the 354px height profile, adding live activity logs to record loop steps.
  - **Key Execution Steps**:
    1. Restyle panels in `AreaBannerRow.jsx` to stretch vertically across the mat.
    2. Build the per-area Activity Log store and route low-priority notifications (item/gold gains, eat/drink, card-finished) into it instead of global toasts — deferred here from the Group 1 Notification Rebuild so the log ships together with its UI.
    3. Integrate the per-area live text log into the Info panel.
- [ ] **Animation for Hero Backdrops**
  - **Description**: Add subtle parallax or ambient particle movement to hero background mats.
  - **Details**: Adds visual depth behind the hero portrait in the banner row and focus views.
  - **Key Execution Steps**:
    1. Apply smooth CSS animations (e.g., panning backgrounds or floating embers) to `RowHeroCard` structures.
  - **Note**: Pure CSS — no sprites required, so it stays out of Group 7.

---

## Group 7 — Deferred Until Art Assets Are Ready
*Sprite-dependent work. Revisit when the art is in hand.*

- [ ] **Sprite Work for Main Bar**
  - **Description**: Integrate final retro-styled pixel art sprites for the navigation bubble buttons, gold display, and status buttons.
  - **Details**: Replaces styled CSS circles with structured pixel artwork indicators.
  - **Key Execution Steps**:
    1. Map custom image URLs or inline SVG sprite paths to buttons in `nav/BubbleMenu.jsx`.
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
- [ ] **Animation for Heroes**
  - **Description**: Implement frame-by-frame pixel art animations for heroes active in loop cycles.
  - **Details**: Support idle, working, and combat attack states using high-resolution spritesheets.
  - **Key Execution Steps**:
    1. Define keyframe animation maps in CSS for each class.
    2. Swap animation classes based on the current loop cell state (e.g., active card type).

---

## Final — After Everything Is Stable

- [ ] **Tauri Migration & Packaging**
  - **Description**: Wrap the web application in a Tauri native shell for desktop distribution.
  - **Details**: Set up configuration schemas, rust crates, and build pipelines targeting executable binaries for Steam distribution.
  - **Key Execution Steps**:
    1. Run `cargo tauri init` inside the workspace directory.
    2. Configure windows sizes, performance flags, and asset bundles inside `src-tauri/tauri.conf.json`.
  - **Note**: Deliberately last — packaging once the game is settled avoids re-testing the desktop build repeatedly.
