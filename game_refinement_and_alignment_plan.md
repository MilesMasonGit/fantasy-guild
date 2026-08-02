# Fantasy Guild Idle — Audit & Refinement Master Inventory

> **Document Version:** v3.2 — Updated 2026-08-02
> **Purpose:** Exhaustive Component & System Inspection Registry for the upcoming Refinement, Alignment, and Testing Phase.
> **Directive:** This document explicitly lists **what elements exist and need to be audited** (their file locations, visual states, interactive surfaces, and functional contracts). Design decisions and specific changes are determined during execution.

---

## 1. Navigation, HUD & Screen Shell

- [ ] **Bubble Navigation Bar** — [`BubbleMenu.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/nav/BubbleMenu.jsx)
  - **Element Scope**: Floating navigation bar rendering primary menu bubble buttons.
  - **Audit Focus**: Icon graphics rendering, active tab indication states, hover tooltips (`GUTooltip.jsx`), button click handlers, menu-side placement docking setting (left vs right).
  - **Progress (in review, going button by button — sprites still pending)**: Pack Shop bubble removed (packs are area-specific now, D-32/D-48); its screen (`PackShopScreen.jsx`) deleted since nothing else linked to it. A "Buy Pack" control (progress text + cost button) now lives on every area banner's top-right header (`bannerHeader.jsx`), duplicated alongside the existing one in Deck Focus mode. Cards/Stations bubble removed entirely — that pane was already marked "temporary by design" in code; station cards now deploy via the Collection Binder's Deployment Panel ("Build at Outpost") until a real in-banner card binder lands (later refinement). The two prompts that pointed at the deleted pane (Outpost's "No Station" slot, an empty Deck slot) are now drag-only, no dead click-shortcut. All 5 remaining bubbles (Guild Hall, Bank, Collection Binder, Area Manager, Settings) now share one "only one view open at once" rule (`ui.nav` in `useUIModals.js`) — bubble clicks only, contextual auto-opens are unaffected — and all 5 toggle closed on a second click. Fixed a Headless UI race where switching directly between the two modal-based views (Settings ↔ Collection Binder) closed the open one but failed to open the other. Awaiting your manual pass to confirm the switching/toggle behavior feels right.

- [ ] **Currency Header & Global Badges** — [`BadgeGutter.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/hud/BadgeGutter.jsx)
  - **Element Scope**: Top HUD gutter displaying global player currencies (Gold, Influence, Gems/Unlocks).
  - **Audit Focus**: Numerical formatting (big number scaling/abbreviation), real-time counter increment animations, responsive spacing across screen resolutions.
  - **Finding (2026-08-01)**: This item's description doesn't match reality, same issue as Global Aura Indicators below. `BadgeGutter.jsx` is actually a per-card informational badge renderer (category/skill icons shown on a card), not a currency HUD at all. The real (and only) currency display is the small gold chip on the Bank nav bubble (`BubbleMenu.jsx`) — there is no separate persistent currency HUD gutter anywhere in the current UI. Whoever picks this item up should re-scope it around `BubbleMenu.jsx`'s gold chip, not this file.

- [ ] **Notification Toasts & Alarm Overlay** — [`Toast.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/Toast.jsx), [`ToastContainer.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/ToastContainer.jsx)
  - **Element Scope**: Toast notification stack and crisis alert ribbons.
  - **Audit Focus**: Fixed viewport bottom-center alignment, toast queuing behavior, auto-dismiss timers, manual collapse/hide toggle state, crisis alert priority punch-through.

- [ ] **Time Bank Widget** — [`TimeBankWidget.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/hud/TimeBankWidget.jsx)
  - **Element Scope**: HUD control for spending banked offline time via fast-forward multipliers.
  - **Audit Focus**: Banked-time readout formatting, fast-forward multiplier button states, active/inactive visual treatment, placement within the HUD layer (noted in-code as a provisional home after the original TopBar was retired), interaction with paused/active loops.

- [ ] **Full-Screen Drawer Shell** — [`FullScreenDrawer.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/fullscreen/FullScreenDrawer.jsx)
  - **Element Scope**: Shared full-viewport shell used by the Guild Hall and Area Manager screens. (Previously also Pack Shop — `PackShopScreen.jsx` was deleted 2026-08-01, packs are bought per-area at the banner now; see Bubble Navigation Bar and Card Pack Opening Overlay items.)
  - **Audit Focus**: Slide-up entry animation, header icon/title/close affordance consistency across the screens that mount it, bubble column visibility while a full-screen view is open, single-open-at-a-time enforcement, scroll containment of body content.

---

## 2. Area Banner & Playmat Interface

- [ ] **Area Banner Container & Layout Scaffold** — [`AreaBannerContainer.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/AreaBannerContainer.jsx), [`BannerLayout.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/BannerLayout.jsx)
  - **Element Scope**: Master container managing active adventure area banners and playmat tracks.
  - **Audit Focus**: Tall mat height profile consistency (354px), multi-banner vertical stacking layout, scroll position retention, area collapse/expand toggle states.
  - **Progress (awaiting your manual pass, motion pass 2026-08-01)**: Collapsing/expanding a banner now glides via the same shared-`layoutId`/`LAYOUT_SPRING` technique as Deck Focus, instead of `AreaBannerContainer.jsx` hard-swapping `CollapsedRow`↔`AreaBannerRow` components — each row now owns its own collapsed↔normal transition internally (both `AreaBannerRow.jsx` and `OutpostBannerRow.jsx`). `CollapsedRow`/`CollapsedOutpostRow` deleted as dead code. A hero being defeated now triggers a red flash + shake across the whole banner box (`AREA_EVENTS.COMBAT_RESOLVED` outcome `defeat`), via an imperative `useAnimate()` shake kept off the layoutId-tracked element to avoid fighting its own transform tracking.

- [ ] **Scenic Biome Mat Backdrop** — [`AreaMat.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/AreaMat.jsx)
  - **Element Scope**: Background rendering frame for adventure biome playmats.
  - **Audit Focus**: Asset loading, pixelated scaling crispness, image asset mapping for all biomes (*Whispering Woods*, *Misty Mountains*, *Iron Crags*, *Sunken Bog*), CSS background ambient particle/parallax overlays (`ParticleOverlay.jsx`).

- [ ] **4-Slot Adventure Track Layout** — [`AreaBannerRow.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/AreaBannerRow.jsx), [`bannerFocus.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/bannerFocus.jsx)
  - **Element Scope**: The 4 identical, unrestricted card slots that make up an area's deck.
  - **Audit Focus**: Empty vs occupied slot visual states, drag-over target highlights, drop validation feedback, horizontal card movement translation animations between slots.
  - **Finding (2026-08-01)**: This item's original file link (`CardSlot.jsx`) doesn't reflect where the 4 slots actually live or render — the normal (collapsed) banner row never shows them individually, only a single "Deck — X/4 slots — Configure" summary card (`RowDeckCard`); the 4 slots only appear once Deck Focus is opened (`DeckFocusSlot` in `bannerFocus.jsx`). Slot-to-slot reorder animation (the "horizontal card movement translation" this item already asked about) was addressed in the motion pass — see Per-Area Card Binder Panel's motion note.

- [ ] **Hero Banner Presence (`RowHeroCard`)** — [`bannerCards.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/bannerCards.jsx)
  - **Element Scope**: Hero card representation rendered on the left side of an area banner row.
  - **Audit Focus**: Hero portrait rendering, state badge indicators (`Idle`, `Working`, `Prepping`, `Fighting`), vital HP/Energy progress bars, equipped gear/consumable miniature icon badges, hero unassign button, hero drag-and-drop drop target.
  - **Progress (awaiting your manual pass, motion pass 2026-08-01)**: A hero landing in the slot now gets a gold glow-burst + bounce (`HeroSlotCell` in `bannerCenters.jsx`), detected by diffing the assigned hero id (not just the drop handler, so it also covers non-drag assignment) and explicitly skipped on first mount so loading a save with a hero already present doesn't falsely trigger it.

- [ ] **Universal Cycle Progress Bar** — [`ProgressBar.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/ProgressBar.jsx), [`RefProgressBar.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/RefProgressBar.jsx)
  - **Element Scope**: Universal progress bar mounted above the hero card on the banner.
  - **Audit Focus**: Progress bar fill animation smoothness, numerical remaining-time readout, phase styling (Draw, Shuffle, Task Work, Attack Speed), skill-theme gradient color matches.
  - **Progress (awaiting your manual pass, motion pass 2026-08-01)**: `ProgressBar.jsx` turned out to already be a heavily-built component (bloom, bit-drift particles, twinkle dust, scribe sparks — all tunable, already gliding smoothly between throttled updates), more sophisticated than assumed going in. Only real gap: nothing marked task completion. Added a bright expanding ring "ping" (`HeaderTaskProgress` in `bannerHeader.jsx`) tied to the same `AREA_EVENTS.CARD_COMPLETED` event as the card's own completion flash below.

- [ ] **Active Card Face Display & Focus Scaffold** — [`ActiveCardFace.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/ActiveCardFace.jsx), [`bannerFocus.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/bannerFocus.jsx), [`FocusScaffold.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/FocusScaffold.jsx), [`bannerCenters.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/bannerCenters.jsx)
  - **Element Scope**: Face of the card currently undergoing execution on the banner runner, and the scaffolding/center-column layout that positions it.
  - **Audit Focus**: Card artwork display, title header, execution countdown timer, composable effect badge rendering (Work Output, Aura, Next-Card, Hazard, Heal), hazard warning indicators, center-column layout consistency across Task/Combat/Project card types.
  - **Progress (awaiting your manual pass, motion pass 2026-08-01)**: The active card flashes green + scale-punches the instant `AREA_EVENTS.CARD_COMPLETED` fires (`ActiveCardCell` in `bannerCenters.jsx`), for every completing card type (gathering, crafting, combat wins) — deliberately a decorative overlay independent of the card's own unmount timing, since the status can already have flipped to "drawing" by the time it paints. Token badges and the "Failed!" stamp (`CardTokenOverlay.jsx`) now animate in/out (scale-pop, and a literal stamp-slam-down for the failure mark) instead of snapping.

- [ ] **Enemy Combat Stage & Feedback** — [`EnemyStage.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/combat/EnemyStage.jsx), [`combatFeedback.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/combat/combatFeedback.jsx), [`EnemyStatBlock.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/combat/EnemyStatBlock.jsx), [`StatusPlacards.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/combat/StatusPlacards.jsx)
  - **Element Scope**: Enemy card display, name/trait stat block, active status placards, and combat animation stage during fight encounters.
  - **Audit Focus**: Enemy avatar, enemy name, trait badges and their discovery/fog-of-war gating, dedicated red enemy attack speed progress bar, hero lunge right animation, enemy lunge left animation, hit rattle shake feedback, floating damage numbers (`DamageFloaters`), status placard icon/stack consolidation for layered instances of the same status.
  - **Progress (awaiting your manual pass, motion pass 2026-08-01)**: Fixed a real bug in `DamageFloaters` — the JS removal timer (1000ms) and the CSS float-up-fade animation it raced (1200ms) had drifted apart, cutting the fade off ~200ms early every time. Now fully framer-motion-driven (`AnimatePresence`, one canonical `FLOATER_MS` constant) with the same visual motion replicated via keyframes. Dropped the "distinct crit punch" idea from the original suggestion — crits don't exist as a concept in the combat engine yet (no `isCrit` field anywhere in the attack event payloads), so there was nothing to key it off. `StatusPlacards` now animate in/out (spring scale) instead of popping.
  - **Follow-up, fixed (2026-08-01)**: The built-but-broken loot particle system (`ParticleOverlay.jsx`) is wired up now. `GICard.jsx` renders `data-card-id` on its root so a completing card can be found (it already received an `id` prop, just never exposed it as a DOM attribute). The landing target changed from the old per-item bank-tile lookup (nothing in the current UI renders `data-item-id`/`data-group-id` anymore — dead code, removed) to a single fixed target: the Bank nav bubble, now carrying `id="bank-bubble-target"` (`BubbleMenu.jsx`). Confirmed both DOM hooks resolve correctly in a live browser check. Follow-up bug also fixed: particles were flying but showing the emoji fallback instead of the item's sprite — `_preloadSprite` was passed the raw item id string instead of the full item object, so the manifest lookup used the wrong key (an item's own id and its `sprite` field are rarely the same string, e.g. `oak_wood` → sprite `wood_oak`). Now matches `ItemIcon.jsx`'s resolution pattern; confirmed the real manifest entry it now resolves to. The actual flight animation still wants your own eyes on it since drag-and-drop is unreliable to simulate through browser automation.

- [ ] **Area Info Panel & Activity Log** — [`bannerPanels.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/bannerPanels.jsx)
  - **Element Scope**: Right-hand info and controls panel on area banners.
  - **Audit Focus**: Real-time yield metrics (Gold/sec, XP/sec), per-area live text activity log feed, loop pause/resume toggle, queue reset button, area pack purchase button trigger.
  - **Progress (awaiting your manual pass, motion pass 2026-08-01)**: The Play/Pause icon on the loop toggle now cross-fades with a quick rotate instead of swapping instantly.

---

## 3. Outpost Banners & Global Auras

- [ ] **Outpost Banner Row** — [`OutpostBannerRow.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/OutpostBannerRow.jsx)
  - **Element Scope**: Single-slot standalone Outpost banner row.
  - **Audit Focus**: Visual distinction from 4-slot adventure banners, single-slot card drop target, crafting station recipe progress bar, required bank materials list, assigned hero frame.
  - **Progress (awaiting your manual pass)**: New "Station Install" focus view (`StationInstallFocusRow` in `bannerFocus.jsx`, mode `installStation`) — clicking the Station Slot (empty or filled) now opens the same expand-in-place binder as Deck Focus, showing every owned station card (global pool, same for every Outpost) stacked below the slot. Distinct from the existing Recipe focus (still opened via the Output card, unchanged). Note: `StationCenter`'s separate "No Station" placeholder text still points at "the Collection Binder" — now slightly stale guidance since the Station Slot itself is the better path; left as-is, out of this pass's scope.

- [ ] **Global Aura Indicators** — [`bannerHeader.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/bannerHeader.jsx)
  - **Element Scope**: Global aura badges and multiplier feeds broadcasted across all active banners.
  - **Audit Focus**: Aura icon indicators, active multiplier value readouts, real-time global modifier aggregation updates.
  - **Finding (2026-08-01)**: This item's description doesn't match reality — there is no Global Aura Indicator UI anywhere in the codebase today. The only "aura" surface is a text status label ("Aura active") for card staffing state; `GlobalModifiers.js` tracks real global buffs from Outpost stations on the backend, but nothing displays them. Building this display (with a pulse on change, as originally suggested) is a real feature, not an animation add — deliberately not built this pass.

---

## 4. Card UI, Binders & Card Pack System

- [ ] **Universal Card Component (`GICard`)** — [`GICard.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/GICard.jsx)
  - **Element Scope**: Core visual card component used across binders, banners, and modals.
  - **Audit Focus**: `sm` vs `lg` size frame rendering, artwork display, card title, composable effect badges, ownership pip count ($3/4$ owned), active slotting counter, drag preview avatar, hover inspect modal trigger (`CardInspection.jsx`).

- [ ] **Card Module Composition Library** — [`ModuleRegistry.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/card-modules/ModuleRegistry.jsx), [`ModuleRenderer.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/card-modules/ModuleRenderer.jsx), and the individual modules (`BlueprintSlotModule`, `CardAssignmentModule`, `CardBadges`, `CardHeaderModule`, `CardPips`, `CardTokenOverlay`, `CombatModule`, `DungeonModule`, `ExpirationModule`, `HordeModule`, `InfoModule`, `InputSlotModule/`, `LootModule`, `ProjectProgressModule/`, `RecipeSelectorModule`, `SkillRequirementsModule`, `SpriteModule`, `TaskDisplay`, `TaskStage`, `ThreatModule`, `ToolSlotModule`) in `src/ui/components/card-modules/`
  - **Element Scope**: The composable module system that assembles a card's face from independent visual blocks, driven by each card's declared module list.
  - **Audit Focus**: Correct module selection per card type/effect combination, layout stacking order when multiple modules are present on one card, module-to-module spacing consistency, token overlay (`CardTokenOverlay.jsx`) layering above/below other modules, input/output slot item rendering (`InputSlotModule/`), project progress row rendering (`ProjectProgressModule/`), orphaned or unused modules in the registry.

- [ ] **Per-Area Card Binder Panel** — [`AreaBinder.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/AreaBinder.jsx), [`BinderStackPanel.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/BinderStackPanel.jsx), [`CardInspection.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/CardInspection.jsx)
  - **Element Scope**: Regional card binder panel embedded on area banners or drawers.
  - **Audit Focus**: Area tab switching, collection progress metrics, owned card grid (hiding silhouettes per storage-focused design), "Buy Area Pack" action button, binder-to-slot drag handles.
  - **Progress (awaiting your manual pass)**: Deck Focus reworked so opening the binder expands the banner vertically instead of replacing the row — the anchor card + 4 slots stay in their existing horizontal row unchanged; the binder pool now renders underneath as solitaire-style cascading stacks (`BinderStackPanel.jsx`, new) dealt into columns, every card directly draggable off its stacked position, with a click-to-inspect slot on the right showing the card as it'd look in a slot. `AreaBinder.jsx` refactored into a data hook (`useAreaBinderEntries`) + reusable card tile rather than its own flat-row renderer. No height cap — other banners below get pushed down and dim, matching the existing focus-mode behavior. Same treatment now also exists for Outposts (see Outpost Banner Row below) — a genuinely new capability, not just a restyle.
  - **Follow-up (owner call 2026-08-01, superseding D-44)**: Uncollected cards (silhouettes) removed from this view entirely — only owned cards render here now; "seen but uncollected" stays a Collection Binder modal feature only, out of scope for this panel. Cards deal into stacks sorted by skill (registry order: Combat → Gathering → Processing → Special, no-skill cards last) instead of raw pool order, so the layout is fixed and legible rather than arbitrary. An owned card with every copy already in the deck now renders in grayscale (was a dim/opacity treatment before).
  - **Motion pass (2026-08-01)**: Deck anchor card now sits on the right in Deck Focus, matching its position in the normal row (was leftmost before) — glides between the two via a shared `layoutId`, along with the whole banner box morphing between normal ↔ Deck Focus instead of popping (`AreaBannerRow.jsx`, `FocusScaffold.jsx`, new `LAYOUT_SPRING` constant in `BannerLayout.jsx`). Deck slots FLIP-slide to their new position on a reorder instead of snapping (content-stable keys + `motion.div layout`). Stack cards deal in with a staggered fade. Hero (Equip) Focus gets a generic fade transition as a side effect of the same plumbing, no dedicated shared-element target. **Deferred ideas from this pass, not built**: staggered re-deal on re-sort (not just first mount), hover-lift on covered stack cards to peek their full face before dragging, depth-matched drop-shadow scaling with stack z-index, reusing the drag ghost's exact spring physics everywhere for full consistency, inspection-slot slide-in/cross-fade on selection change, a soft SFX layer on expand/collapse/select (explicitly skipped this pass — visual only), restricting `GICard`'s hover parallax/tilt to only the topmost stack card (perf + avoids jitter on mostly-hidden cards), and extending this same shared-element technique to Hero Focus and the Outpost Station views.

- [ ] **Universal Card Bucket Panel** — [`UniversalBucketPanel.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/banner/UniversalBucketPanel.jsx)
  - **Element Scope**: Universal boost card binder for cards granted via the Guild Upgrade Tree.
  - **Audit Focus**: Universal card grid display, cross-area deployment indicators, slotting capacity rules.

- [ ] **Card Pack Opening Overlay** — [`PackOpeningOverlay.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/PackOpeningOverlay.jsx)
  - **Element Scope**: The 3D card reveal modal shown after buying a pack. (Purchasing itself happens at each area's own banner — `bannerHeader.jsx`'s `BannerBuyPack` — not through a separate shop screen; `PackShopScreen.jsx` was deleted 2026-08-01.)
  - **Audit Focus**: Face-down card deal layout, 3D flip-on-click animation, "NEW CARD" / "DUPLICATE PIP +1" badges, instant reveal toggle behavior (`ui.instantPackReveal`).

- [ ] **Collection Binder Modal & Library Sub-Panels** — [`CollectionBinderModal.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/CollectionBinderModal.jsx), [`BinderCardTile.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/BinderCardTile.jsx), [`DeploymentPanel.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/DeploymentPanel.jsx), [`LibraryAreaSetSection.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/LibraryAreaSetSection.jsx), [`LibraryCardPreviewGutter.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/LibraryCardPreviewGutter.jsx), [`LibraryTabNavigation.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/LibraryTabNavigation.jsx), [`binderCatalog.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/library/binderCatalog.js)
  - **Element Scope**: Full-catalog modal covering owned/discovered enemies, items, and cards (a superset "Library" view distinct from the per-area binder).
  - **Audit Focus**: Tab navigation between enemy/item/card catalogs, search filtering, discovery-gated silhouette states, card preview gutter accuracy, deployment panel drag/assign affordances, catalog data pulled correctly from `enemyRegistry`, `itemRegistry`, and `cardRegistry`.

---

## 5. Hero Management & 9-Slot Loadout Grid

- [ ] **Hero Dock & Drawer Scaffold** — [`HeroDock.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/dock/HeroDock.jsx), [`HeroDockTab.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/dock/HeroDockTab.jsx)
  - **Element Scope**: Full-height glassmorphism side drawer for hero roster and detailed hero sheets.
  - **Audit Focus**: Slide-out animation, menu-side placement configuration, split-pane layout (Roster/Bench list $\leftrightarrow$ Selected Hero detail sheet).

- [ ] **Hero Roster & Bench List (`HeroDockCard`)** — [`HeroDockCard.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/dock/HeroDockCard.jsx)
  - **Element Scope**: Individual hero summary cards in the roster drawer list.
  - **Audit Focus**: Hero portrait, level badge, assigned area status, HP/Energy bars, unassigned bench filter, drag handle for deployment.

- [ ] **Hero Detail Sheet & Stat Breakdown** — [`DockSkillsGrid.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/dock/DockSkillsGrid.jsx)
  - **Element Scope**: High-level hero sheet displaying stats and skill proficiencies.
  - **Audit Focus**: Hero portrait backdrop animation, Level/XP progress bar, 4 Combat Skill levels (Melee, Ranged, Magic, Defense), 7 core combat stat values, hover tooltips for stat derivation formulas.

- [ ] **Hero 9-Slot Flexible Loadout Grid** — [`DockEquipmentGrid.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/dock/DockEquipmentGrid.jsx)
  - **Element Scope**: 9-slot inventory panel on hero sheets for equipment and consumables.
  - **Audit Focus**: Slot layout grid, drag-to-equip target behavior from Bank, click-to-unequip action, weapon style indicator (Melee/Ranged/Magic), consumable quaffing threshold indicators ($<25\%$ HP/Energy), prep-phase potion indicators.

- [ ] **Hero Edit Modal (Rename, Portrait, Retirement)** — [`HeroEditModal.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/HeroEditModal.jsx)
  - **Element Scope**: Non-drag-and-drop hero management actions — rename, portrait repick, and retirement.
  - **Audit Focus**: Name-length validation and max-length enforcement, portrait picker grid against `heroPortraits.js`, retirement confirmation flow and its Influence-preview calculation (`RetirementFormula.js`), recruit-cost preview accuracy (`RecruitCostCalculator.js`), warning/destructive-action styling on the retire button.

---

## 6. Bank Inventory & Bulk Operations

- [ ] **Bank Drawer Shell & Tab Navigation** — [`BottomFolderDrawer.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/BottomFolderDrawer.jsx), [`TabStrip.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/TabStrip.jsx)
  - **Element Scope**: Bottom folder drawer shell and bank tab strip.
  - **Audit Focus**: Drawer open/close animation, 20-tab strip display (5 default free + 15 locked), first-item 32px sprite headers, lock icons on locked tabs, tab selection state.

- [ ] **Bank Inventory Grid & Search (`BankTab`)** — [`BankTab.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/BankTab.jsx)
  - **Element Scope**: Item grid inside bank tabs, text search input, and category filters.
  - **Audit Focus**: Grid slot layout, text search filtering, category tab filters (All, Equipment, Materials, Consumables, Quest Items), item stack count badges.

- [ ] **Item Icon Tile (`ItemIcon`) & Durability Bar** — [`ItemIcon.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/ItemIcon.jsx), [`ItemDurabilityBar.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/vault/ItemDurabilityBar.jsx)
  - **Element Scope**: Individual item icon renderer used across bank tabs, hero slots, and recipes, plus the durability strip shown under equipped gear/weapons.
  - **Audit Focus**: 32px sprite rendering, category/rarity backdrop frames, stack size text overlays, hover tooltip popovers (`GUTooltip.jsx`), drag source setup, durability bar color thresholds and edge alignment under `ItemIcon`/equipment slots.

- [ ] **Bank Select Mode & Bulk Selling** — [`BankTab.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/BankTab.jsx)
  - **Element Scope**: Multi-select mode and bulk item management in the bank.
  - **Audit Focus**: "Select Mode" toggle button state, multi-stack selection outlines, drag-selection to move to another tab, bulk sell confirmation modal layout, total gold value preview.

- [ ] **Shared Inspection Panel** — [`InspectionPanel.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/InspectionPanel.jsx)
  - **Element Scope**: Fixed-width column on the far right of the Bottom Drawer, always visible while the drawer is open, showing detail for whatever Card or Item was last clicked in any drawer pane.
  - **Audit Focus**: Correct hand-off between `ItemInspection` (from `BankTab.jsx`) and `CardInspection.jsx` sources, panel persistence across tab switches, empty-state when nothing is selected, layout at narrow drawer widths.

---

## 7. Guild Hall, Recruitment & Quest System v2

- [ ] **Guild Hall Upgrade Tree Screen** — [`GuildHallScreen.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/fullscreen/GuildHallScreen.jsx)
  - **Element Scope**: Main screen displaying global guild upgrade nodes.
  - **Audit Focus**: Upgrade node cards (Bank Tabs, Stack Size, Roster Cap, Quest Slots, Outposts), rank pips ($1/5$, $2/5$, MAX), Gold/Influence upgrade buttons, locked prerequisite overlays.

- [ ] **Hero Recruitment Section** — [`RecruitmentSection.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/drawer/RecruitmentSection.jsx)
  - **Element Scope**: Hero candidate recruitment panel.
  - **Audit Focus**: Candidate cards (portrait, name, class archetype, initial skills, cost), "Roll Candidates" button and cost scaling, "Hire Hero" button and roster limit checks.

- [ ] **Area Quest Boards & Progress Bars** — [`AreaUnlockOverlay.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/AreaUnlockOverlay.jsx)
  - **Element Scope**: Quest panels attached to locked region cards.
  - **Audit Focus**: Per-area unlock progress bar, Main Story Quest slot, Procedural Gather/Defeat Quest slots, requirement counters, reward previews, "Claim Reward" interaction.

- [ ] **Quest Control Bar** — [`AreaManagerScreen.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/fullscreen/AreaManagerScreen.jsx)
  - **Element Scope**: Global quest status control bar.
  - **Audit Focus**: 5-minute countdown clock readout, "Abandon All Quests" trigger and confirmation prompt, "Refresh Now" trigger and scaling cost calculation.

---

## 8. Global Modals, Overlays & UI Primitives

- [ ] **Modal & Surface Primitives** — [`GIModal.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/GIModal.jsx), [`GISurface.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/GISurface.jsx), [`Badge.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/Badge.jsx), [`Button.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/Button.jsx), [`GUTooltip.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/GUTooltip.jsx)
  - **Element Scope**: The Headless-UI-backed modal shell and the shared glassmorphism surface/badge/button/tooltip primitives every panel in the game is built from.
  - **Audit Focus**: Focus trapping and escape-to-close on `GIModal`, enter/exit transition smoothness, `GISurface` blur/interactive variants for visual consistency across all consumers, tooltip positioning near viewport edges, button variant/disabled-state styling coverage.

- [ ] **Settings Modal** — [`SettingsModal.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/SettingsModal.jsx)
  - **Element Scope**: 4-tabbed global settings interface (Notifications, Display, Audio, Advanced/Save).
  - **Audit Focus**: Per-tab control states and persistence round-trip through `SettingsManager.js`, live-apply vs requires-restart settings, volume slider behavior against `AudioSystem.js`, save-related controls surfaced on this modal vs. the Slot Selection modal.

- [ ] **Save Slot Selection Modal** — [`SlotSelectionModal.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/modals/SlotSelectionModal.jsx)
  - **Element Scope**: Save slot picker — new game, continue, delete slot.
  - **Audit Focus**: Slot metadata display (playtime formatting, last-played timestamp via `formatTimeAgo`), delete-slot confirmation flow, new-slot creation validation, slot list refresh after `SaveManager` writes.

---

## 9. Drag-and-Drop & Viewport Engine

- [ ] **DnD-Kit Drag System** — [`DndKit.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/dnd/DndKit.jsx), [`DragGhost.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/dnd/DragGhost.jsx), [`dragConstants.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/dnd/dragConstants.js), [`EntityDraggable.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/EntityDraggable.jsx)
  - **Element Scope**: The pointer-tracked drag-and-drop system (2026-07-15 rework) underlying every card/hero/item drag interaction in the game.
  - **Audit Focus**: Drag overlay cursor-snap behavior, droppable surface hit-testing (`pointerWithin`) across overlapping zones (banner slots, hero dock, bank), drag sound effect triggers (`DRAG_SFX`), drag-kind gating (`DRAG_KIND`) preventing invalid drops, `EntityDraggable` wrapper consistency across consumer components, EventBus emissions during drag lifecycle.

- [ ] **Engine & Viewport Context Providers** — [`EngineContext.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/context/EngineContext.jsx), [`ViewportContext.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/context/ViewportContext.jsx)
  - **Element Scope**: React context providers exposing the Vanilla game engine instance and shared high-frequency motion values (pan/zoom) to the component tree.
  - **Audit Focus**: Context availability guarding (`useEngine` throwing outside provider), motion-value pan/zoom synchronization with the DnD system bypassing React re-renders, stale-closure risk in consumers reading engine state outside `useGameState`.

---

## 10. Core Engine, State & Persistence Systems

- [ ] **Game State & Schema** — [`GameState.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/GameState.js), [`StateSchema.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/state/StateSchema.js)
  - **Element Scope**: Canonical in-memory game state shape and its schema definition.
  - **Audit Focus**: Schema field coverage against every system that reads/writes state, default-value correctness for new-game state, unused or orphaned state fields.

- [ ] **Engine Bootstrap & Game Loop** — [`EngineBootstrap.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EngineBootstrap.js), [`GameLoop.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/GameLoop.js), [`EventBus.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EventBus.js), [`EventBatch.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/EventBatch.js)
  - **Element Scope**: Engine startup sequence, the tick loop driving all live systems, and the pub/sub event bus (with batching) connecting engine to UI.
  - **Audit Focus**: Boot ordering/dependency correctness, tick rate and drift handling, event batching flush cadence and dropped-event risk under high event volume, subscriber cleanup/memory leaks on component unmount.

- [ ] **Time Management** — [`TimeManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/TimeManager.js), [`TimeBankManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/TimeBankManager.js)
  - **Element Scope**: Elapsed/offline time tracking and the offline Time Bank spend mechanic.
  - **Audit Focus**: Offline-time accrual accuracy across app close/reopen, Time Bank cap enforcement, fast-forward multiplier math against `loopConstants.js` `TIME_BANK` values, interaction with paused loops.

- [ ] **Save System** — [`SaveManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/SaveManager.js), [`SaveMigration.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/SaveMigration.js), [`SaveSlotHelper.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/SaveSlotHelper.js)
  - **Element Scope**: Save/load persistence, versioned save migrations, and save slot metadata helpers.
  - **Audit Focus**: Migration coverage for every historical save schema version up to current (0.5.0 per Area Deck Rework), autosave cadence, save corruption/failure handling, slot metadata (playtime, timestamp) accuracy, round-trip fidelity for every state field.

- [ ] **Settings, Audio & Asset Preload** — [`SettingsManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/SettingsManager.js), [`AudioSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/AudioSystem.js), [`AssetPreloader.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/AssetPreloader.js)
  - **Element Scope**: Persisted user settings, sound effect/music playback, and startup asset preloading.
  - **Audit Focus**: Settings persistence round-trip, volume/mute control effectiveness across every SFX trigger in the codebase (drag, combat, pack opening, notifications), preload coverage/failure fallback for missing sprites, preload blocking vs. progressive load UX.

- [ ] **Discovery & Notification Systems** — [`DiscoveryManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/DiscoveryManager.js), [`NotificationSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/NotificationSystem.js), [`NotificationSubscriptions.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/NotificationSubscriptions.js), [`areaEvents.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/core/areaEvents.js)
  - **Element Scope**: Fog-of-war discovery tracking (enemies, items, traits) and the toast/notification dispatch pipeline including area-level event triggers.
  - **Audit Focus**: Discovery-gate correctness across every UI surface that reads `useDiscovery` (item icons, enemy stat blocks, tooltips), notification dedupe/throttling, subscription registration completeness against every event `areaEvents.js` can emit.

---

## 11. Economy & Inventory Backend

- [ ] **Commerce & Currency** — [`CommerceSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/economy/CommerceSystem.js), [`CurrencyManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/economy/CurrencyManager.js), [`TransactionProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/economy/TransactionProcessor.js)
  - **Element Scope**: Gold/Influence balances and all buy/sell transaction processing (packs, bulk sell, upgrades, recruitment).
  - **Audit Focus**: Transaction atomicity (no partial-charge states on failure), currency floor/negative-balance guards, gold-value calculations matching displayed previews in the UI (bulk sell, pack cost), Influence-only vs Gold-only gating consistency.

- [ ] **Inventory Backend** — [`InventoryManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/inventory/InventoryManager.js), [`InventoryStore.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/inventory/InventoryStore.js), [`InventoryFormatter.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/inventory/InventoryFormatter.js), [`InventoryGroupManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/economy/InventoryGroupManager.js), [`ItemRateTracker.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/inventory/ItemRateTracker.js)
  - **Element Scope**: Stack-based item storage, per-tab grouping, stack size cap enforcement, and the gain/sec rate tracker feeding the activity log.
  - **Audit Focus**: Stack cap enforcement against Guild Hall upgrade rank, tab-overflow handling when a tab fills, rate tracker accuracy/decay window, formatter output consistency (search text, sort order) against what `BankTab.jsx` renders.

---

## 12. Equipment & Durability Systems

- [ ] **Equipment Manager & Validator** — [`EquipmentManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/equipment/EquipmentManager.js), [`EquipmentValidator.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/equipment/EquipmentValidator.js), [`equipmentCategories.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/equipmentCategories.js), [`equipmentConstants.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/equipmentConstants.js)
  - **Element Scope**: Equip/unequip logic, slot-category validation, and the equipment category/constant registries.
  - **Audit Focus**: Slot-vs-item-category validation coverage (weapon style mismatches, consumable-only slots), equip/unequip side effects on live combat stats, category registry completeness against every equippable item in `itemRegistry.js`.

- [ ] **Durability System** — [`DurabilitySystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/equipment/DurabilitySystem.js)
  - **Element Scope**: Equipment condition decay and break/repair logic.
  - **Audit Focus**: Decay rate per use/tick, zero-durability behavior (auto-unequip vs. stat penalty vs. break), repair cost calculation, UI sync with `ItemDurabilityBar.jsx`.

---

## 13. Hero Lifecycle, Skills & Consumption Backend

- [ ] **Hero Manager & Generator** — [`HeroManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/HeroManager.js), [`HeroGenerator.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/HeroGenerator.js)
  - **Element Scope**: Hero creation (recruitment roll) and the top-level hero management API.
  - **Audit Focus**: Randomized stat/skill roll distribution fairness, name/portrait pool exhaustion handling (`nameRegistry.js`, `heroPortraits.js`), roster cap enforcement.

- [ ] **Hero Lifecycle Logic** — [`HeroLifecycle.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/logic/HeroLifecycle.js), [`HeroLookup.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/logic/HeroLookup.js), [`HeroRehydration.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/logic/HeroRehydration.js), [`HeroRoster.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/logic/HeroRoster.js), [`HeroState.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/logic/HeroState.js)
  - **Element Scope**: Hero state transitions (Idle/Working/Prepping/Fighting/Wounded/Retired), roster mutation, and post-load save rehydration.
  - **Audit Focus**: State-machine transition legality (no illegal state jumps), rehydration completeness after the recent retirement sweep (C-17/C-18), retired-hero data retention/cleanup, roster list consistency after retire/hire operations.

- [ ] **Regeneration & Consumption Systems** — [`RegenSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/RegenSystem.js), [`ConsumptionSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/ConsumptionSystem.js)
  - **Element Scope**: Passive HP/Energy regeneration and consumable auto-quaffing logic tied to the 9-slot loadout.
  - **Audit Focus**: Regen tick rate and formula alignment with `FormulaRegistry.js`, quaffing threshold trigger accuracy ($<25\%$ HP/Energy), prep-phase-only potion gating, double-consumption or race-condition risk when multiple thresholds trip in one tick.

- [ ] **Skill System, XP Curve & Retirement Formula** — [`SkillSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/hero/SkillSystem.js), [`XPCurve.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/utils/XPCurve.js), [`RetirementFormula.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/utils/RetirementFormula.js), [`RecruitCostCalculator.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/utils/RecruitCostCalculator.js)
  - **Element Scope**: XP gain/level-up math for the 4 combat skills, hero-level averaging, retirement Influence payout, and scaling recruit costs.
  - **Audit Focus**: XP curve smoothness (no level-up cliffs or dead zones), hero level = avg-of-4-skills correctness per the locked 15-skill rework decision, retirement payout formula sanity across low/high level heroes, recruit cost scaling curve against roster size.

---

## 14. Card Assembly & Resolution Pipeline

- [ ] **Card Assembly** — [`CardAssembler.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/CardAssembler.js), [`CardFactory.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/CardFactory.js), [`ModularSyncer.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/assembler/ModularSyncer.js), [`SlotMapper.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/assembler/SlotMapper.js), [`assembler/TraitRegistry.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/assembler/TraitRegistry.js)
  - **Element Scope**: Runtime card instance construction from card definitions, module-to-data syncing, and slot mapping.
  - **Audit Focus**: Assembled card shape completeness against every module the UI expects to render, sync correctness when underlying card data changes mid-run, slot mapping collisions.

- [ ] **Card Manager & Preflight** — [`CardManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/CardManager.js), [`CardManagerUtils.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/CardManagerUtils.js), [`CardPreflight.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/CardPreflight.js)
  - **Element Scope**: Central card lifecycle manager and the preflight checks run before a card can be slotted/executed.
  - **Audit Focus**: Preflight validation coverage (requirements, bank materials, hero eligibility) matching what the UI actually blocks, error messaging clarity when preflight fails.

- [ ] **Work, Combat & Quest Processors** — [`WorkProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/WorkProcessor.js), [`CombatAttackProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/CombatAttackProcessor.js), [`CombatProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/CombatProcessor.js), [`CombatResolutionProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/CombatResolutionProcessor.js), [`QuestProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/QuestProcessor.js), [`StatProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/StatProcessor.js)
  - **Element Scope**: Per-card-type tick processors driving task work output, combat attack resolution, and quest progress.
  - **Audit Focus**: Processor selection correctness per card type, tick-to-tick output consistency (no double-application or dropped ticks), combat resolution output matching what `CombatFormulas.js` predicts, quest progress increment accuracy against `QuestTracker.js`.

- [ ] **Requirement Processing** — [`RequirementProcessor.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/RequirementProcessor.js), [`RequirementRegistry.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/logic/RequirementRegistry.js)
  - **Element Scope**: Declarative requirement checks (skill level, item, hero state) gating card/action availability.
  - **Audit Focus**: Registry coverage of every requirement type referenced in card/data JSON, failure-reason messaging surfaced to the player.

- [ ] **Card Effect Resolvers & Recruit System** — [`effectResolvers.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/effects/effectResolvers.js), [`RecruitSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/cards/RecruitSystem.js)
  - **Element Scope**: Resolution logic for composable card effects (Work Output, Aura, Next-Card, Hazard, Heal) and the in-run recruitment card flow.
  - **Audit Focus**: Effect resolver coverage against every effect type declared in `cardEffects.js`/`effectRegistry.js`, stacking/ordering rules when multiple effects apply to one card, recruit-card cost and candidate pool correctness.

---

## 15. Loop, Station & Deck Runtime Engine

- [ ] **Loop Runner & Deck Slots** — [`LoopRunner.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/LoopRunner.js), [`DeckSlotManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/DeckSlotManager.js), [`SlotFailures.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/SlotFailures.js)
  - **Element Scope**: The core Area Deck Loop tick engine — draw, shuffle, work, and failure handling across the 4 slots.
  - **Audit Focus**: Draw/shuffle randomness distribution, slot failure trigger conditions and recovery, loop pause/resume state correctness, interaction with the Universal Cycle Progress Bar phases (Draw, Shuffle, Task Work, Attack Speed).

- [ ] **Station & Outpost Runtime** — [`StationManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/StationManager.js), [`StationSlotManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/StationSlotManager.js), [`OutpostManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/OutpostManager.js)
  - **Element Scope**: Single-slot Outpost banner runtime and station crafting recipe execution.
  - **Audit Focus**: Recipe material consumption correctness against `recipeRegistry.js`, station slot drop validation matching the Station Install focus view's drag source (`StationInstallFocusRow`/`BinderStackPanel` in `bannerFocus.jsx` — `StationsTab.jsx` was deleted 2026-08-01, this is its replacement), Outpost hero-assignment single-slot enforcement.

- [ ] **Modifiers, Buffs & Gradual Input** — [`AreaModifiers.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/AreaModifiers.js), [`GlobalModifiers.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/GlobalModifiers.js), [`LoopBuffs.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/loop/LoopBuffs.js), [`GradualInputSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/exploration/GradualInputSystem.js)
  - **Element Scope**: Area-scoped and global modifier aggregation (Outpost station passive buffs, in particular), plus the gradual-reveal input system for exploration cards. Note: `GlobalModifiers.js` has no UI display anywhere yet — see the Global Aura Indicators finding in Section 3, "displayed multiplier readouts" below currently means nowhere.
  - **Audit Focus**: Modifier stacking order (additive vs. multiplicative) matching displayed multiplier readouts, buff expiration timing, gradual input reveal pacing against the UI's exploration card presentation.

---

## 16. Status, Token & Modifier Effects Backend

- [ ] **Status Effect Engine** — [`StatusEffectSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/effects/StatusEffectSystem.js)
  - **Element Scope**: Status condition processing engine (registry-driven, 5s clock).
  - **Audit Focus**: Tick frequencies, damage/healing formulas, duration decrements, stack limits, purge behaviors for all 7 status types, DoT-can-kill edge cases, deferred §5 flow-control behaviors.

- [ ] **Modifier Aggregation & Mutators** — [`ModifierAggregator.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js), [`MutatorStamping.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/effects/MutatorStamping.js), [`SlotTokens.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/effects/SlotTokens.js), [`TokenAxes.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/effects/TokenAxes.js)
  - **Element Scope**: The Three-Bucket modifier math, card mutator stamping, and slot token system underlying `CardTokenOverlay.jsx`.
  - **Audit Focus**: Bucket-math correctness (base/additive/multiplicative separation), mutator stamp persistence across save/load, token axis exhaustiveness against every token type rendered in the UI, the one visual check noted as outstanding from the Card Mutators & Tokens project.

---

## 17. Progression, Collection & Quest Backend

- [ ] **Binder & Collection Systems** — [`BinderManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/BinderManager.js), [`BinderMastery.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/BinderMastery.js), [`CollectionManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/CollectionManager.js)
  - **Element Scope**: Per-area card binder state, Binder Mastery bonus tiers, and cross-system collection tracking.
  - **Audit Focus**: Mastery tier threshold correctness and bonus application, collection percentage calculation matching what `AreaBinder.jsx` displays, loot-fix regression coverage from the recent Binder Mastery work.

- [ ] **Guild Upgrade & Progression System** — [`GuildUpgradeManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/GuildUpgradeManager.js), [`ProgressionSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/ProgressionSystem.js), [`RegistryManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/RegistryManager.js)
  - **Element Scope**: Guild Hall upgrade tree state, tier/rank progression, and dynamic registry management.
  - **Audit Focus**: Upgrade prerequisite gating matching the tree's visual locked-overlay states, rank-up cost scaling, dynamic registry consistency after runtime content changes (CMS sync path).

- [ ] **Quest Board & Tracking** — [`QuestBoardSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/QuestBoardSystem.js), [`QuestTracker.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/QuestTracker.js), [`ObjectiveRegistry.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/progression/logic/ObjectiveRegistry.js)
  - **Element Scope**: Main Story and Procedural Gather/Defeat quest generation, progress tracking, and objective type registry.
  - **Audit Focus**: Objective type coverage against every quest defined in `questRegistry.js`/`quests.json`, progress increment triggers firing from the correct game events, reward claim idempotency, 5-minute refresh/abandon interaction with `QuestBoardSystem`.

---

## 18. Combat & Loot Engines

- [ ] **7-Stat Combat Engine Module** — [`CombatFormulas.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/utils/CombatFormulas.js), `src/systems/combat/`
  - **Element Scope**: Core combat math and stat derivation routines.
  - **Audit Focus**: HP, Armor, Block, Damage, Accuracy, Crit, Speed formulas, RPS matchup multipliers, naked hero baseline calculations, tuning constants centralized in `FormulaRegistry.js`.

- [ ] **Loot & Wounded Systems** — [`LootSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/combat/LootSystem.js), [`WoundedSystem.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/systems/combat/WoundedSystem.js)
  - **Element Scope**: Post-combat loot roll resolution and the defeat/wounded/retreat penalty path.
  - **Audit Focus**: Drop table roll fairness against `dropTableRegistry.js`, loot-fix correctness (referenced as "the real loot fix" in Binder Mastery work), defeat penalty severity curve, retreat-path triggering conditions and their interaction with hero HP/Energy state.

---

## 19. Content Data, Registries & Schemas

- [ ] **Config Registries** — every file in [`src/config/registries/`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/) (`areaSetRegistry`, `biomeRegistry`, `cardConstants`, `cardRegistry`, `specialCards`, `classRegistry`, `dropTableRegistry`, `dungeonRegistry`, `enemyRegistry`, `enemyTraitRegistry`, `eventRegistry`, `heroPortraits`, `invasionRegistry`, `itemRegistry`, `nameRegistry`, `questRegistry`, `recipeRegistry`, `skillRegistry`, `sprite-manifest`, `statusRegistry`, `tagRegistry`, `threatRegistry`, `tileRegistry`, `traitRegistry`, `TokenRegistry`)
  - **Element Scope**: The full set of static content registries every runtime system reads from.
  - **Audit Focus**: Cross-registry referential integrity (every ID referenced elsewhere resolves to a real entry), duplicate/orphaned entries, naming consistency, registry entries with missing sprite/portrait/icon mappings.

- [ ] **Card Config & Formula Registry** — [`FormulaRegistry.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/FormulaRegistry.js), [`DatabaseManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/DatabaseManager.js), [`CardValidator.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/cards/CardValidator.js), [`card-presets.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/cards/card-presets.js), [`cardEffects.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/cards/cardEffects.js), [`effectRegistry.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/cards/effectRegistry.js), [`constants.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/constants.js), [`guildUpgrades.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/guildUpgrades.js), [`loopConstants.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/loopConstants.js), [`questConfig.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/questConfig.js)
  - **Element Scope**: Central tuning constants, the in-memory content database manager, and card definition validation.
  - **Audit Focus**: Validator coverage against every field the CMS/game actually consumes, constant duplication between this layer and individual registries, stale/unused constants.

- [ ] **JSON Content Files** — every file under [`data/`](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/) (`cards/action/mutators.json`, `cards/area/areas.json`, `cards/blueprint/blueprint_cards.json`, `cards/boost/*.json`, `cards/combat/*.json`, `cards/consumable/consumables.json`, `cards/pack/booster_pack.json`, `cards/project/project_cards.json`, `cards/tasks/*.json`, `cards/universal/universals.json`, `effects.json`, `encounters.json`, `enemies.json`, `items.json`, `quests.json`, `recipes.json`, `stations.json`, `subskills.json`)
  - **Element Scope**: All game content defined as data rather than code.
  - **Audit Focus**: Schema compliance against `data/schemas/` (`common.schema.json`, `explore-card.schema.json`, `task-card.schema.json`), template drift against `data/templates/` (`explore.template.json`, `task-basic.template.json`, `task-crafting.template.json`), content gaps per area (Whispering Woods vs. Misty Mountains vs. unbuilt areas), exponential regional scaling value sanity across the 11 loop skills.

---

## 20. Visual Asset, Icon & Palette Pipeline

- [ ] **Asset & Icon Utilities** — [`AssetManager.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/utils/AssetManager.js), [`IconUtils.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/utils/IconUtils.js), [`sprite-manifest.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/config/registries/sprite-manifest.js)
  - **Element Scope**: Sprite/asset path resolution and icon lookup utilities feeding every image-rendering component in the game.
  - **Audit Focus**: Fallback/placeholder behavior for missing sprite manifest entries, path resolution consistency between dev and packaged (Tauri) builds, manifest completeness against every ID in `itemRegistry.js`/`enemyRegistry.js`/`cardRegistry.js`.

- [ ] **Palette System** — every file under [`data/palettes/`](file:///c:/Users/16048/Projects/fantasy_guild_v2/data/palettes/) (`aap-splendor128.json`, `custom_palettes.json`, `fantasy-guild-256.json`, `materials_library.json`, `palette_groups.json`, `universal_palette.json`)
  - **Element Scope**: Pixel-art color palette definitions used by art tooling and in-game rendering.
  - **Audit Focus**: Palette group organization, custom vs. base palette overlap/conflicts, unused palette entries.

---

## 21. Developer, QA & Debug Tooling

- [ ] **In-Game QA Dashboard** — [`TestDashboard.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/TestDashboard.jsx), [`FPSCounter.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/base/FPSCounter.jsx)
  - **Element Scope**: In-app developer tool for spawning test data (heroes, area sets) and verifying React/engine data-binding reactivity, plus the FPS overlay.
  - **Audit Focus**: Whether this remains dev-only gated (not shipped in production/Steam builds), spawn-data realism vs. actual game state shape, FPS counter accuracy and performance overhead of running it.

- [ ] **Layout Sandbox ("Sizing Forge")** — [`LayoutSandbox.jsx`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/components/sandbox/LayoutSandbox.jsx), [`cardSizeStore.js`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/ui/dev/cardSizeStore.js)
  - **Element Scope**: Standalone tool for tuning card-to-slot-to-icon size ratios.
  - **Audit Focus**: Whether ratio values tuned here have actually been carried into production component CSS, dev-only route gating.

- [ ] **External Analysis Tools** — [`curve_explorer.html`](file:///c:/Users/16048/Projects/fantasy_guild_v2/tools/curve_explorer.html), [`reachability.mjs`](file:///c:/Users/16048/Projects/fantasy_guild_v2/tools/reachability.mjs)
  - **Element Scope**: Standalone (non-bundled) tooling for exploring progression curves and checking content reachability.
  - **Audit Focus**: Whether these tools still run against the current data shape (schema drift risk since they're outside the main build), value as a documented workflow vs. an abandoned one-off script.

- [ ] **Standalone Combat Balancer (SCB)** — `tools/scb/` / `SCB_concept.md`
  - **Element Scope**: Headless Monte Carlo simulation engine.
  - **Audit Focus**: Direct shared combat module import validation, Time-to-Kill (TTK) output, 100-loop sustainability measurement, content anomaly report generator.

- [ ] **Vitest Unit Test Suite** — `vitest.config.js` / [`src/tests/`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src/tests/) (39 suites, incl. `SaveRoundtrip`, `DefeatPenalties`, `BinderMastery`, `LoopRunnerFlow`, `Mutators`, `StatusEffects`, `HeroDock`, `useGameState`)
  - **Element Scope**: Automated regression test suite (559 tests as of 2026-08-01, all passing).
  - **Audit Focus**: Execution speed, test coverage across core engines, assertion validity following recent reworks, coverage gaps against the newer backend systems listed in Sections 9-19 that may lack dedicated suites.

---

## 22. Tauri Native Wrapper & Packaging

- [ ] **Tauri Application Shell** — [`tauri.conf.json`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src-tauri/tauri.conf.json), [`lib.rs`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src-tauri/src/lib.rs), [`main.rs`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src-tauri/src/main.rs), [`capabilities/default.json`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src-tauri/capabilities/default.json)
  - **Element Scope**: Desktop application configuration shell, native entry points, and the capability/permission manifest.
  - **Audit Focus**: Window dimensions, performance switches, asset inclusion paths, capability scope (no more native permission than the app actually needs), Steam executable packaging pipeline.

- [ ] **Application Icon Set** — every file under [`src-tauri/icons/`](file:///c:/Users/16048/Projects/fantasy_guild_v2/src-tauri/icons/) (Windows Square/Store tiles, `.icns`, `.ico`, `.png` variants)
  - **Element Scope**: Packaged app icons for Windows/Steam/taskbar presentation at every required resolution.
  - **Audit Focus**: Placeholder vs. final-art icons, resolution completeness against Tauri/Windows packaging requirements, visual consistency of the icon across all sizes.

---

## Execution Instructions for Audit Passes

When conducting an audit pass on any item listed above:
1. Open the corresponding component file directly from the link provided.
2. Inspect all listed visual states, player interactions, props, data feeds, and drag contracts.
3. Determine design refinements, visual upgrades, or bug fixes directly during the pass.
