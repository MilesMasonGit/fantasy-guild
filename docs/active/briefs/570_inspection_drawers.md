# Brief 570 — Inspection drawers: heroes at the bottom, the world and items on the right

*Written 2026-11-10 by the planning agent. Concept: [concept_inspection_drawers.md](../concept_inspection_drawers.md):
read it whole; every line of it is the owner's wish and this brief does not repeat the details. Code facts below were
checked by a read-only agent and spot-checked; verify them.*

**Ruling (owner, 2026-11-10).** A region's **playtime counts time away too**: catch-up time is added to the place the
guild was on.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, the concept,
briefs [340](340_hero_bar_detail.md), [380](380_world_map_detail.md), [390](390_guild_hall_detail.md) and
[400](400_bank_detail.md) (all built: this reworks what they made).

Code to start from (verify):
- **Hero bar**: `BottomHeroDock.jsx` (the border line in `DockStrip`), mounted in `ReactRoot.jsx` outside `WorldCamera`
  (shows on the world map) but inside `HallCamera`'s mat side (not on the Hall screen); `BankHeroPanel.jsx` and
  `HeroDockTab.jsx` (the vertical tabs, shown while the Bank is open); the Shop (`ShopPanel.jsx`, z 90) covers the dock
  (z 40). Equip feedback: `dockEquip.equipOrAnnounce` → `UI_SCREEN_CALLOUT` → `ScreenCalloutLayer.jsx` (`SpeechFrame`,
  `SPEECH_TONE.CANT`, `.ui-frame-chamfer-red`).
- **Hero sheet**: `drawer/HeroInspectionSheet.jsx` inside `BankHeroPanel` (a full-height side panel, z 100: figure,
  name and HP, `DockEquipmentGrid`, skills in two columns). No combat stats view exists today.
- **Bank**: `BankItemWindow.jsx`, `.gi-bank-shift` / `bankShift` (`tailwind.css`, `ReactRoot.jsx`), `ItemTip.jsx`
  (`itemTipFacts`: type, Equippable, tags).
- **World map**: `WorldPanel.jsx`, `regionPreview.regionFacts`; `cellMat.js` (before settling: `water` 0 to 1, `stone`
  outcrops and ridge; no grass or stone area share); `MatCap.matCap()` and `Shop.capStatus()` (the active mat only).
  No per-region playtime: only `meta.totalPlaytime`.
- **Guild Hall**: `GuildHallDetails.jsx` (the Return to Playmat button), `GuildUpgradeInspection.jsx`, hover-switching via
  `hoveredUpgradeId` in `ReactRoot.jsx`; `GuildUpgradeManager.purchase` buys one rank only; star positions are authored
  (`data/hallStars.json` `node` and label x/y).
- **Shared**: `NOTIFICATION_COLUMN` (`boardConstants.js`), the Menu on Right Side setting (`ui.bubbleMenuRight`),
  `ArrowScrollList.jsx`, the studded frames and backdrops.

## Needs

Nothing queued. Brief 480 L3 puts small Limes in these drawers, so it comes after this brief.

## Phases

| Phase | What | Tier |
|---|---|---|
| D1 | **The hero bar everywhere** (concept §1, first part). The bottom bar shows on every screen, the Guild Hall included, above the side drawers; the vertical tabs (`HeroDockTab` in the Bank) retire, and every drag that used them (items onto heroes, a hero's flag) works on the bottom bar. No border line. **Equip bubbles** over the hero on the bar, about 3 s: plain frame on success, the red CANT frame with the exact reason and numbers on refusal, replacing the screen callout for equipping. **One bottom drawer at a time**: the Shop and the Hero drawer close each other. ⚠️ The Shop covers the bar today: say how the bar and the Shop share the bottom (the owner allowed the Shop to cover the bar, brief 410). | builder |
| D2 | **The Hero Inspection Drawer** (concept §1). It rises from the bottom behind the bar, three blocks left to right: summary (2× figure, name, HP bar, quill, X; the flag moved left behind the shoulder), the equipment grid (always visible), and a toggle between the **Skills grid** (columns of 4, in the concept's order, no headers, no scrolling) and **Combat stats** (new: style, damage ranges, speed, gear effects, resistances, style cuts, all read from the combat code's own numbers, never a second copy). **Skill hover** tooltip and the **Skill panel** on click, above the drawer, as the concept lists. A skill's purpose text: draft one line per skill in one file for the owner to edit. ⚠️ Fit at 1366 and 1920 with the menu on either side; stop and report with a screenshot if the three blocks don't fit. | builder |
| D3 | **The right-side drawer, and the Item drawer** (concept §2). One shared drawer: flush, full height, `NOTIFICATION_COLUMN` wide, studded frame with the screen's backdrop, on the side opposite the menu. **Item drawer** opens and closes with the Bank (no X), defaults as the concept says, its six parts in order; tag pills with a one-line explanation each, drafted in one file for the owner to edit; Use stays in the actions (brief 400). `BankItemWindow` and the mat's Bank shift retire. **`ItemTip`** drops the type and Equippable lines everywhere. | builder |
| D4 | **The World Map drawer** (concept §3) on D3's drawer. Quill for rename; the preview with **`28/128`** in its corner (count over the place's cap, for any settled place, not only the active one: say how the cap is read); **three dials, Water, Grass and Stone %**, on settled and unsettled cells, worked out from what world generation knows (⚠️ if an unsettled cell's split can't be had cheaply without laying out its mat, stop and report with the cost); **playtime per region**, counting live play and time away on the place the guild was on (a new save field; old saves aren't protected); the removed rows and Token list go. | engineer |
| D5 | **The Upgrade drawer** (concept §4) on D3's drawer. Starts closed; click a star to open, no hover-switching; the Return button goes. Larger greyscale icon, title, description; the **rank list** with Roman numerals that turn Arabic on hover, scrolled to the last bought and next rank, one short line per rank. **Choosing a later rank**: its price with short numbers; hovering Upgrade shows the total for every rank up to it; **"Upgrade (+3 Ranks)" buys them all at once**, all or nothing, through the engine (a new purchase of several ranks, one save, one ceremony); greyed with the shortfall when unaffordable. **Star titles never overlap**: a drawing-time rule nudges stars that share a band (positions stay as authored); list the pairs it moved. | builder |

D1, then D2. D3, then D4 and D5 (either order). D1 and D3 may run side by side (different files: check `ReactRoot.jsx`).

## Done when

- Gate green (`TESTING.md`). Engine work **same** for all but D4 (a new save field) and D5 (a new purchase); both
  tested, and buying three ranks costs and gives exactly what three single buys would.
- In the running game, named as verified, at 1366 and 1920 and with the menu on each side: the hero bar on the mat,
  Bank, Shop, world map and Hall; equipping from the Bank onto the bar (success and refusal bubbles); the Hero drawer's
  three blocks, both toggles, a skill hover and its panel; the Shop and Hero drawer closing each other; the Bank with
  its Item drawer and no mat shift; an item tooltip; a settled and an unsettled world cell (dials, count, playtime
  after time away); the Hall drawer closed at start, a multi-rank buy, an unaffordable target, Roman numerals, no
  overlapping titles. Screenshots of each.
- GDD and `UI_STYLE.md` updated; `bench:draw --compare` once for the batch.
- **Eye-check: yes**, two looks: D1 with D2, then D3 to D5. The owner edits the skill and tag lines at the looks.

## Not in this brief

Selling and Discard (T-306). Limes's blurbs (brief 480 L3).

## Owner to-do

The two looks; edit the drafted skill purpose lines and tag explanations. No CMS work and no new art.
