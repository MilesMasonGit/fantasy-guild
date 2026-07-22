# Hero Dock & Hand-of-Cards — Implementation Roadmap v1

**Status:** Phase 0 done · **Created:** 2026-07-21 · **Baseline:** v0.3.1 (283/283 tests green)

This is the authoritative implementation plan for the Hero Dock rework.

**Read first, in this order:**
1. [`CLAUDE.md`](CLAUDE.md) — project ground rules and working practices.
2. [`hero_dock_concept.md`](hero_dock_concept.md) — the design vision.
3. This file — what to actually build, in what order.

> [!IMPORTANT]
> **§Locked Decisions below overrides the concept document wherever they
> disagree.** The concept was written without reference to the codebase; six
> of its assumptions did not match reality and were resolved with the project
> owner on 2026-07-21. Do not re-litigate them. If implementation reveals one
> is genuinely unworkable, **stop and raise it with the project owner** rather
> than quietly choosing something else.

> [!NOTE]
> **Sequencing — resolved 2026-07-21.** Card Mutators
> ([`mutator_roadmap_v1.md`](mutator_roadmap_v1.md)) is complete, merged to
> `main` and tagged `v0.3.1`. This work lives on the **`hero-dock`** branch,
> cut from `main` at that tag.

---

## Implementation Status

Update this table as work lands. A phase is only ✅ when its smoke test has
actually been run in the game, not merely when the code compiles.

| Phase | Name | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Reality check & save break | ✅ Done & verified | `6ec1c96` | F1–F9 all re-verified against merged v0.3.1, none drifted. `GAME_VERSION` `0.2.0` → `0.4.0`. Tests 283/283. Verified in-game: a planted `0.2.0` save is refused with the exact player-facing message and the slot screen stays up; a new game starts clean, writes `0.4.0`, and round-trips through save/reload. |
| 1 | Six equipment slots | ✅ Done & verified | `fd8642a` | Items declare a **category** (`hand`/`hat`/`chest`/`trinket`); heroes carry six **slot instances** (`hand1`,`hand2`,`hat`,`chest`,`trinket1`,`trinket2`). `resolveTargetSlot` fills the first free instance, swapping the first when all are full. New `getPrimaryWeaponSlot`/`getPrimaryWeapon` helpers give combat its single-weapon tie-break. 12 weapons → `hand`, 2 armours → `chest`. Tests 288/288 (+5 new). Verified in-game through the real EquipmentManager: sword→hand1 (DMG 3), bow→hand2 (DMG 7, stacked), staff with both hands full swaps hand1 (DMG 6), armour→chest (DEF 2), unequip hand2 (DMG 2); all six slots render in order; loop reset fires on equip change; shape survives save/reload. |
| 2 | Starter hat & trinket content | ⬜ Not started | — | ~8 new items |
| 3 | Bench retirement | ⬜ Not started | — | ~53 refs, 19 files |
| 4 | Dock strip (unpinned tabs) | ⬜ Not started | — | First visible change |
| 5 | Pinning & expanded card | ⬜ Not started | — | 2-pin comparison |
| 6 | Drag & drop wiring | ⬜ Not started | — | Deploy / recall / equip / transfer |
| 7 | Edit modal & drawer retirement | ⬜ Not started | — | Deletes HeroSideDrawer |
| 8 | Small Mode & tactile polish | ⬜ Not started | — | Responsive + SFX + ghost slot |
| 9 | Deletion sweep | ⬜ Not started | — | Legacy hero UI, reachability check |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done & verified · 🔒 Deferred

---

## Locked Decisions (owner, 2026-07-21)

These answer gaps between the concept and the code. **They override the
concept document.**

| # | Question | Decision |
|---|---|---|
| D1 | Concept shows 6 equipment slots; game has 2 | **Build 4 new slot types.** Master list: **Hand, Hand, Hat, Chest, Trinket, Trinket** |
| D2 | Hand slot rules | **Two free hands.** Either hand takes any weapon; bonuses stack. No two-handed or offhand concept |
| D3 | Hat/Trinket have no items | **Author a starter set** as part of this work so all six slots are usable |
| D4 | "15 attribute slots" in the stats grid | **The 15 skills** (4 combat + 11 loop), level + XP%, 5 rows of 3 |
| D5 | Which heroes appear in the dock | **Retire the bench entirely.** The dock is the whole roster; `rosterLimit` caps it |
| D6 | Recruiting at roster cap | **Blocked.** No auto-bench, no retire prompt. Retire someone or upgrade Guild Hall |
| D7 | Old saves with benched heroes | **Break old saves outright** — no migration, same as the deck-loop rework |
| D8 | Hero actions (retire/bench/deploy/customize) | **Side drawer and those features are retired.** An **Edit** button on the dock card opens a modal holding name, portrait, and Retire |
| D9 | Dock vs play area | **Everything overlays.** The dock floats over the banners; the banner list gets bottom padding so the last row can scroll clear |
| D10 | Bank drawer | **Unchanged** — keeps pushing the banners in the layout flow |
| D11 | Outside-click dismissal | **Always unpins.** Equipping is done by dropping onto the *unpinned* tab, so this never conflicts |
| D12 | Concept §5.2 drag-pin | **Dropped.** Dragging shows a ghost slot in the dock and a compact token under the cursor — no auto-pin |

---

## Architecture Findings (verified against the code 2026-07-21)

The concept was written as if greenfield. It isn't. These were confirmed by
reading the source and **materially shape the plan**.

### F1 — Only ~14 items in the entire game are equippable

All hardcoded in [`itemRegistry.js`](src/config/registries/itemRegistry.js):
**12 with `equipSlot: 'weapon'`, 2 with `equipSlot: 'armor'`**. The 58 items in
`data/items.json` are materials, food and drink — **none carries an
`equipSlot` at all**.

**Consequence:** the D1 slot expansion is cheap on the data side. There is no
bulk item migration; it's 14 hand-edits in one file. It also means Hat and
Trinket launch empty, which is why D3 exists.

### F2 — Equipment is a shared-reference model, not an inventory move

[`EquipmentManager.equipItem()`](src/systems/equipment/EquipmentManager.js:23)
checks `InventoryManager.hasItem(itemId, 1)` and then simply writes
`hero.equipment[slot] = itemId`. **The item never leaves the Bank.**

**Consequence:** two concept features are already free.
- §4.2 "Auto-Swap Engine … the old item is automatically returned to the Bank"
  — `equipItem` already calls `unequipItem` on an occupied slot, and the item
  was in the Bank the whole time.
- §4.3 "Click-to-Unequip … immediately sends that item back to the Bank" — the
  same no-op. `unequipItem` just nulls the link.

**Caveat for §4.3 hero-to-hero transfer:** because nothing is consumed, a naive
"drop on hero B" would leave the item equipped on **both** heroes if stock
allows. Phase 6 must explicitly unequip from A as part of the transfer.

### F3 — Card-wide auto-equip already exists on the banner

[`bannerCenters.jsx:76`](src/ui/components/banner/bannerCenters.jsx:76) already
makes the assigned hero's banner card a drop target that accepts `DRAG_KIND.ITEM`
and calls `equipItem`. **Concept §4.4 ("Direct In-Situ Equipping") is done.**
Do not rebuild it; the dock tab reuses the same `accepts`/`onDrop` shape.

### F4 — The drag system already does most of concept §5

[`DndKit.jsx`](src/ui/dnd/DndKit.jsx) is dnd-kit with a `DragOverlay`: a
floating ghost that tracks the pointer, glides into the resolved slot on a
valid drop, and uses dnd-kit's default spring-back on a miss. Accept/reject
ring cues (`ACCEPT_CLS` / `REJECT_CLS`) and per-kind SFX are wired.

**Consequence:** Phase 6 is mostly *declaring targets*, not building physics.
The only real gaps are the **ghost slot** in the dock (§5.2) and the
**press-down 2px depress** cue (§5.1).

**One conflict:** the `PointerSensor` activation distance is **8px**
([DndKit.jsx:84](src/ui/dnd/DndKit.jsx:84)); the concept says 5px. This is a
single global setting shared by cards and items. **Recommendation: keep 8px**
rather than making every drag in the game twitchier for one surface. Flag to
the owner in Phase 6 rather than changing it silently.

### F5 — Responsive tiering already exists and broadcasts

[`BannerLayout.jsx`](src/ui/components/banner/BannerLayout.jsx) measures the
container and drops the whole banner row from the `md` (256px) tier to `sm`
(128px), publishing `ui:card_tier_changed`, which `useUIModals` already stores
as `ui.cardTier`.

**Consequence:** Small Mode (§3 State C) should **subscribe to the existing
tier**, not add a competing `width < 1024px` media query. Two independent
responsive systems would disagree at the boundary.

### F6 — Hero actions live in one place, and it isn't the drawer

[`HeroSideDrawer.jsx`](src/ui/components/drawer/HeroSideDrawer.jsx) is only a
roster list. Every hero action — deploy picker, recall, bench/activate, retire
— lives in [`HeroInspection.jsx`](src/ui/components/drawer/HeroInspection.jsx),
which renders inside the bottom drawer's shared
[`InspectionPanel`](src/ui/components/drawer/InspectionPanel.jsx) alongside
card and item inspection.

**Consequence:** D8 deletes *two* things — the drawer, and the `hero` branch of
the Inspect panel. The panel itself must survive for cards and items.

### F7 — Breaking saves is free

[`SaveMigration.js`](src/systems/core/SaveMigration.js) throws
`IncompatibleSaveError` for any `savedVersion !== GAME_VERSION`, and
`SaveManager` already surfaces "This save is from a previous version and
cannot be loaded." **D7 costs one version bump**, no migration code.

### F8 — There is no hero customize modal

`ui:open_hero_customize` is published only by the dead
[`HeroIdentityStrip`](src/ui/components/HeroIdentityStrip.jsx), and
`useUIModals` handles it by *opening the side drawer*. **The Edit modal in D8
is built from scratch.** There is no name/portrait editing in the game today —
scope it as new work, not a port.

### F9 — Dead pre-rework hero UI is still in the tree

[`HeroIdentityStrip.jsx`](src/ui/components/HeroIdentityStrip.jsx) and the
whole `src/ui/components/hero/` module set (`HeaderModule`, `StatBarsModule`,
`EquipmentListModule`, `SkillsModule`) are orphaned from the pre-rework UI.
They still use the retired `EntityDraggable` drag system and read
`hero.assignedCardId`, which the deck loop no longer sets. The only live
reference is `CardSlot.jsx` rendering `idPrefix="slot"`.

`EquipmentListModule` still lists `['weapon','armor','food','drink']` — food
and drink were retired in CR-029. **Do not use these as the basis for the dock
card.** They are Phase 9 deletions.

Also dead: [`CombatAttackProcessor.js:128`](src/systems/cards/logic/CombatAttackProcessor.js:128)
reduces durability on `['head','body','hands','feet']` — slots that have never
existed. Phase 1 should repoint it at the real new slot names.

---

## Phase 0 — Reality check & save break

**Goal:** confirm nothing drifted while mutators landed, and break old saves once.

1. Branch from `main` (after mutators merge) as `hero-dock`.
2. Re-verify F1–F9 against the code. Note any drift in this file before writing code.
3. Bump `GAME_VERSION` in [`StateSchema.js`](src/state/StateSchema.js) and the
   five version files listed in `CLAUDE.md`.
4. Add an `## [Unreleased]` entry to `CHANGELOG.md`.

**✅ Smoke test:** launch the game, load an existing save — it must be refused
with the incompatible-version notification. Start a new game and confirm it
plays normally.

> **Result (2026-07-21):** passed. A planted `0.2.0` save shows as "ver 0.2.0"
> on the slot screen; Load Sync refuses it (`[SaveManager] Refused slot 0: Save
> version 0.2.0 is incompatible with game version 0.4.0`), fires the notification
> *"This save is from a previous version and cannot be loaded. Please start a new
> game."*, leaves the save file intact and keeps the slot screen up. A new game
> starts with no console errors, writes schema `0.4.0`, and reloads cleanly.
>
> **Note for future phases:** `computer{action:"screenshot"}` times out against
> this game — the particle overlay renders continuously at 60 FPS so the
> renderer never idles. Verify via `read_page`, `read_console_messages`, and
> `javascript_tool` state reads instead.

---

## Phase 1 — Six equipment slots

**Goal:** heroes carry Hand, Hand, Hat, Chest, Trinket, Trinket (D1, D2).

The item's `equipSlot` becomes a **category** (`hand` / `hat` / `chest` /
`trinket`); the hero holds **slot instances** (`hand1`, `hand2`, `hat`,
`chest`, `trinket1`, `trinket2`).

1. Rewrite [`equipmentConstants.js`](src/config/registries/equipmentConstants.js)
   with the instance list, the category list, and the instance→category map.
2. `equipItem(heroId, itemId)` resolves the item's category, then fills the
   **first free instance** of that category; if all are occupied, it swaps the
   **first** one. Keep the existing modifier source key shape (`equip:hand1`).
3. Migrate the 14 items in `itemRegistry.js`: `weapon` → `hand`, `armor` → `chest`.
4. Update `canHeroEquip` in [`EquipmentValidator.js`](src/systems/equipment/EquipmentValidator.js)
   for categories; keep the food/drink rejection.
5. Repoint durability callers: `CombatAttackProcessor` line 73 (`'weapon'` →
   the hero's occupied hand instances) and line 127-128 (`'armor'` → `chest`;
   delete the phantom `['head','body','hands','feet']` list or repoint it at
   `hat`/`trinket1`/`trinket2`).
6. Update the two live gear UIs so the game stays playable:
   [`HeroInspection.jsx:142`](src/ui/components/drawer/HeroInspection.jsx:142)
   and [`bannerFocus.jsx:255`](src/ui/components/banner/bannerFocus.jsx:255).
7. Update `HeroSystem.test.js` and `EquipmentRequirements.test.js`.

**Smoke test:** equip two different swords on one hero — both land, both hands
fill, and the damage bonus reflects both. Equip a third — it swaps hand 1.
Unequip from hand 2 and confirm the modifier drops. Confirm a hero's area loop
resets on each equip change (the existing Loop Reset Rule).

> **Result (2026-07-21):** passed, driven through the real `EquipmentManager`
> on a real generated hero. Sword → `hand1` (DAMAGE 3); bow → `hand2`
> (DAMAGE 7, both stacking); staff with both hands full displaced `hand1`
> (DAMAGE 6 = staff 2 + bow 4); leather armour → `chest` (DEFENSE 2);
> unequipping `hand2` dropped DAMAGE to 2. The gear panel renders
> HAND/HAND/HAT/CHEST/TRINKET/TRINKET in order. Assigning the hero and then
> changing gear reset the area loop (`activeCardIndex` 2→0, `executionTimer`
> 1234→0). A save round-trip preserved all six keys. No console errors.

### ⚠️ Pre-existing bug this phase surfaced (NOT fixed here)

`getHeroDamageRange` ([CombatFormulas.js:193](src/utils/CombatFormulas.js:193))
computes `base = heroBaseDamage(skill) + (weapon?.damage || 0) + damageBonus`,
but `damageBonus` is `aggregator.query(DAMAGE)`, which **already includes**
that same weapon's `damage` (added by `recalculateEquipmentModifiers`). So a
weapon's damage has always been counted twice.

This predates the Hero Dock work — it is not a regression — but two hands make
it louder: a 3-damage sword plus a 4-damage bow yields `+3 (primary) +7
(aggregator) = +10` instead of `+7`. Left alone per the project rule against
bundling unrelated fixes into phase work. **Needs an owner call**: either drop
the `weapon` parameter from the formula (the aggregator already has it), or
stop registering weapon `damage` as a modifier. Prefer the former — the
aggregator is the single source of truth everywhere else.

---

## Phase 2 — Starter hat & trinket content (D3)

**Goal:** all six slots have something to put in them.

Author roughly 8 items in `itemRegistry.js` following the existing gear shape
(`equipSlot`, `maxDurability`, stat fields, `skillRequired` where sensible):
~4 hats (a defensive one, a skill-bonus one, a low-level starter, one crafted
tier-2) and ~4 trinkets (leaning on the `assignedEffect` list `EquipmentManager`
already understands: `accuracyBonus`, `evasionBonus`, `energyEfficiency`,
`penetration`).

Each needs a sprite. Reuse existing sprites if the art isn't ready rather than
blocking the phase — flag the placeholder list to the owner.

Also add at least one obtainable source (a recipe, a drop, or a shop entry) for
two of them so they can be acquired in normal play.

**Smoke test:** acquire a hat and a trinket in-game, equip both, confirm their
bonuses show up in the hero's combat numbers.

---

## Phase 3 — Bench retirement (D5, D6)

**Goal:** `GameState.bench` ceases to exist. The roster is the whole roster.

1. `HeroLifecycle.addHero()` — **reject** when `heroes.length >= rosterLimit`
   instead of pushing to bench. Return a failure result; publish a notification.
2. `RecruitSystem` — grey out / block hire at cap with a clear message
   ("Roster full — retire a hero or upgrade the Guild Hall").
3. Delete `moveHeroToBench` / `moveHeroToActive` from
   [`HeroRoster.js`](src/systems/hero/logic/HeroRoster.js) and their callers.
4. Remove `bench` from `StateSchema.INITIAL_STATE`, its validation, the
   `GameState.bench` getter, and the rehydration loop in `GameState.js:73`.
5. Simplify the dual-list lookups in `HeroLookup.js`, `HeroRehydration.js`,
   `HeroLifecycle.js`, `HeroAssignmentManager.js:123`, `BadgeGutter.jsx:154`,
   `InspectionPanel.jsx:29`, and both hero drawer components.
6. Retire the `hero_benched` / `hero_activated` events and the `hero_bench`
   SFX mapping in `AudioSystem.js:174`.
7. `LoopRunner.js:592` and `StationSlotManager.js:133` only *mention* benching
   in comments — reword, no logic change.

Old saves are already refused (Phase 0), so **no migration is needed** (D7).

**Smoke test:** fill the roster to its cap, then try to recruit — blocked with a
message, no ghost hero created. Buy a `roster_size` Guild Hall rank and confirm
recruiting opens up again. Retire a hero and confirm the slot frees.

---

## Phase 4 — Dock strip, unpinned tabs (concept §2, §3 State A)

**Goal:** the first visible change — a permanent bottom strip of hero tabs.

New `src/ui/components/dock/` directory. Build:
- `HeroDock.jsx` — the fixed-bottom strip, `z-index: 200`, rendered from
  `ReactRoot` outside the banner column. Overlapping flat card layout, fixed
  positions in roster order.
- `HeroDockTab.jsx` — State A: ~70–80px tall, face sprite left, name + level
  and the activity status pill stacked right.

The status pill shows the **area name** (e.g. "Whispering Woods"), not "Banner 1"
— areas are named and there are only three. Fall back to "Reserve" when
unassigned, and a combat indicator when the area is `in_combat`.

Per D9, add bottom padding equal to the dock height to the banner scroll
container in [`AreaBannerContainer.jsx:52`](src/ui/components/banner/AreaBannerContainer.jsx:52)
so the last banner can scroll clear of the dock.

Do **not** touch the Bank drawer (D10). Its bottom rows will sit behind the
dock; give its scroll container the same bottom padding.

**Smoke test:** every hero on the roster has a tab, in a stable order, visible
at all times. Deploy a hero from the existing side drawer and watch their pill
update to the area name. Confirm banners still scroll fully into view.

---

## Phase 5 — Pinning & the expanded card (concept §3 State B)

**Goal:** click a tab to pull the full card up out of the hand.

- `HeroDockCard.jsx` — State B, `z-index: 300`, ~300px tall. Section 1 is the
  **exact same header component** as the tab (visual continuity is the whole
  metaphor). Section 2 is the 2×3 equipment grid, 32px sprites, image only,
  hover tooltip via the existing `GUTooltip`. Section 3 is the 5×3 skills grid
  (D4) — reuse the shape already in `HeroInspection.jsx:120`, not the dead
  `SkillsModule`.
- Pin state lives in `useUIModals` as an ordered array, max 2 (concept §3);
  pinning a third drops the oldest.
- Outside-click unpins all (D11) — a single document-level listener that
  ignores clicks inside the dock.

**Smoke test:** pin two heroes side by side and compare their skills. Pin a
third — the oldest closes. Click a banner — both unpin. Confirm the header
doesn't visually jump between tab and pinned states.

---

## Phase 6 — Drag & drop wiring (concept §4, §5)

**Goal:** every transfer path works. Per F4 this is mostly declaring targets.

1. **Dock → Banner (deploy).** `useEntityDrag` on the tab with
   `DRAG_KIND.HERO`; the banner hero slot already accepts it (F3). The dock
   position shows a ghost outline at `opacity: 0.35` while dragging (§5.2).
2. **Banner → Dock (recall).** The dock strip becomes a `DropTarget` accepting
   a hero payload carrying `from` — the same contract the side drawer's
   `hero-recall` target uses today. Also add the bottom-right **X** on banner
   hero cards (concept §2) calling `unassignHero`.
3. **Bank → tab (equip).** The unpinned tab is a card-wide drop target
   accepting `DRAG_KIND.ITEM`, calling `equipItem` — auto-swap is free (F2).
   Per D11 this works on the *unpinned* tab, which is always visible.
4. **Click-to-unequip.** Click an occupied slot on a pinned card → `unequipItem`.
5. **Hero → hero transfer.** Drag an equipped sprite off a pinned card onto
   another tab. **Must unequip from the source first** (F2) or the item ends up
   on both heroes.
6. Confirm the 8px vs 5px threshold with the owner (F4) before changing it.

**Smoke test:** run every path end to end — deploy by drag, recall by drag,
recall by X, equip from Bank onto a tab, swap an occupied slot, click-unequip,
and transfer a sword from one hero to another (verify it left the first). Drop
a hero on empty space and confirm the spring-back.

---

## Phase 7 — Edit modal & drawer retirement (D8)

**Goal:** the dock fully replaces the old hero UI.

1. New `src/ui/modals/HeroEditModal.jsx` — name (text field), portrait (picker
   over the class's available sprites), and **Retire** behind the existing
   two-step confirm, showing the Influence payout. Wire `ui:open_hero_customize`
   to it in `useUIModals` (F8).
2. Add the **Edit** button to the pinned card.
3. Delete [`HeroSideDrawer.jsx`](src/ui/components/drawer/HeroSideDrawer.jsx)
   and its `ReactRoot` wiring, the `ui.heroPanel` state, and the play-area
   margin shift it drove ([ReactRoot.jsx:94](src/ui/ReactRoot.jsx:94)).
4. Delete [`HeroInspection.jsx`](src/ui/components/drawer/HeroInspection.jsx)
   and the `hero` branch of `InspectionPanel` — **keep the panel** for cards
   and items (F6).
5. Remove the now-dead **Heroes** bubble from
   [`BubbleMenu.jsx:77`](src/ui/components/nav/BubbleMenu.jsx:77), and repoint
   the `ui:open_drawer` handler's `tab: 'heroes'` branch (which several empty
   banner slots publish) at… nothing — the dock is always visible, so those
   prompts should just say "drag a hero from the dock".

**Smoke test:** rename a hero and change their portrait — both persist across a
save/load. Retire a hero from the modal and confirm the Influence payout and
that their dock tab disappears. Confirm the Cards and Bank panes still inspect
normally.

---

## Phase 8 — Small Mode & tactile polish (concept §3 State C, §5)

1. **Small Mode:** collapse tabs to ~48px square face-only chips. Drive it from
   the existing `ui.cardTier` signal (F5), not a new media query.
2. **Press-down cue:** 2px depress / `scale: 0.98` on pointer-down (§5.1).
3. **SFX:** map to existing `AudioSystem` clips rather than adding files —
   `drag` for pickup, `hero_assign` for a valid banner drop, `unassign` for the
   recoil, `item_equip` for equips. Flag to the owner if a distinct click-down
   or recoil sound is wanted.
4. Verify pinned cards stay on-screen above an open Bank drawer, and that the
   dock is usable at 1280×800 and at a narrow window.

**Smoke test:** shrink the window until banners drop to the `sm` tier and
confirm the dock collapses in step. Exercise a full deploy at both sizes.

---

## Phase 9 — Deletion sweep

**Goal:** remove what the rework orphaned (F9).

1. Delete `HeroIdentityStrip.jsx` and `src/ui/components/hero/*`
   (`HeaderModule`, `StatBarsModule`, `EquipmentListModule`, `SkillsModule`,
   `ActivityBadgeModule`) — after repointing `CardSlot.jsx`'s `idPrefix="slot"`
   render at a small inline hero chip.
2. Delete `EntityDraggable.jsx` if Phase 9 leaves it unreferenced (check the
   three card-module callers first — they may still need it).
3. Run `node tools/reachability.mjs` and clear anything it flags.
4. Run the full test suite; update the baseline count in `CLAUDE.md`.
5. Update `CLAUDE.md`'s "Next Major Feature" section and this table.

**Smoke test:** full play session — new game, recruit to cap, equip across all
six slots, deploy to all three areas, fight, get injured, retire someone,
save and reload.

---

## Conventions for this work

- **One phase per session** where practical. Commit at the end of a verified
  phase, update the status table in the same commit.
- **Verify in the running game** (`npm run dev`), not just via tests. Every
  phase from 4 onward is UI-facing.
- **Run `npm test` before each commit.**
- **Don't bundle unrelated cleanup** into phase work — flag it separately.
- **Ask, don't assume.** If a phase needs a decision this file and the concept
  don't answer, stop and ask the project owner.

---

## Settled — do not re-ask

Everything in §Locked Decisions, plus:

- The status pill shows the **area name**, not "Banner N".
- Small Mode uses the **existing card tier**, not a new breakpoint.
- SFX **reuse existing clips**; no new audio assets in scope.
- **`InspectionPanel` survives** Phase 7 — only its hero branch is deleted.
- Save migration is **out of scope** (Phase 0 breaks saves once, deliberately).

---

## Open questions for the owner

Raise these at the phase that needs them, not before:

1. **Phase 2:** placeholder sprites for hats/trinkets, or block on new art?
2. **Phase 6:** keep the drag threshold at 8px (global), or drop to 5px for
   everything?
3. **Phase 7:** which portraits can a hero choose from — any sprite, or only
   their class's set?
4. **Phase 8:** are distinct click-down and recoil sounds wanted, or is
   reusing the existing clip set fine?

---

## Handoff Prompt

> I'm resuming the Hero Dock rework. Get oriented first:
>
> 1. Read `CLAUDE.md` — ground rules and working practices.
> 2. Read `hero_dock_concept.md` — the design vision.
> 3. Read `hero_dock_roadmap_v1.md` in full. Pay attention to the **Locked
>    Decisions** table (these override the concept doc — don't re-litigate) and
>    the **Architecture Findings** F1–F9.
> 4. Check the Implementation Status table and tell me what phase we're on.
> 5. Confirm you're on the `hero-dock` branch with a clean tree.
> 6. Sanity-check the code against what the roadmap assumes for the phase we're
>    about to start. Flag anything that's drifted.
>
> Then **stop and report back**: what phase we're starting, what it involves in
> plain language, and any open questions. I don't code, so keep it plain.
>
> **Don't write code yet.** Once I give the go-ahead, implement that phase, run
> its smoke test in the actual game, update the status table, and stop before
> the next one.
