# Brief 430 — Detail pass: notifications after time away, and settling

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "10. Notifications": read its list
first; the item numbers below are that list's, and the owner's wish is what counts. Banners staying
until clicked, item stubs and the black banners: looked at, no change.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, [concept_notifications.md](../concept_notifications.md),
GDD §9 and §10.

Code to start from (verify): `src/systems/core/CatchUp.js`, `SaveManager.js`,
`src/systems/notifications/routing.js`, `Banners.js`, `ItemStubs` (same folder),
`src/ui/components/hud/CatchUpOverlay.jsx`, `catchUpSummary.js`, `src/systems/atlas/Atlas.js`,
`src/systems/board/SpriteLayer.js` (`BANK_FULL`), `src/systems/progression/RegistryManager.js`
(`ITEM_DISCOVERED`).

## Needs

Nothing. If brief 440 has run or runs later, keep its layout: this
brief only adds to what it lists.

## Phases

| Phase | What | Tier |
|---|---|---|
| N1 | **Nothing goes missing after time away** (item 1). Today a catch-up keeps the bus quiet, so every notification route is skipped and new recipes, a full Bank losing items, first finds and knock-outs give no banner or stub; the summary lists only the wounded of those. **Shown both ways, as the owner chose.** **In the summary**: new recipes, first finds and items lost to a full Bank, as sections of their own; say what shows when there's none. **As banners and stubs when the summary closes**: recipes, Bank full and knock-outs through the normal banners, merged as live play merges them ("Aela unlocked 3 recipes"), each staying until clicked; first finds as gold "New!" stubs. Sounds play as for live banners. ⚠️ **Count them while the catch-up runs and hand them over afterwards**, as the summary counts its own; don't un-quiet the bus, and draw no random numbers: the catch-up must play the same as live play. ⚠️ **Undo**: turning a catch-up down reloads the old save, so nothing from it may appear. ⚠️ **A short catch-up shows no summary** (`SHOW_GAP_MS`): its banners appear at once. ⚠️ Loading clears banners (`GAME_LOADED`), so hand over after it. A long absence must stay merged and not produce a wall of banners or stubs. | builder |
| N2 | **A gold banner when a place is settled** (item 2). A new banner kind from the Atlas's `created` announcement, with the place's name; the first camp of a new game says nothing. **The order (owner, 2026-11-05): this banner first, then the title and the heroes walking in (brief 380 M5); no fight starts by itself.** It must not cover the reveal; say what you did. | builder-lite |

Either order; N2 is one route and one banner kind, and may share N1's branch.

## Done when

- Gate green (`TESTING.md`). Engine work **same**: a catch-up plays exactly as before.
- In the running game, named as verified, using the time-away tools (TESTING): a return where a level-up
  unlocked recipes, with a first find, with a full Bank losing items and with a hero knocked out: each in
  the summary, then its banner or stub after closing it; a long absence, merged; Undo on the summary shows
  none; a short gap with no summary shows them at once; a place settled, with its banner.
- Tests for the hand-over, and that a catch-up with and without it plays the same.
- `concept_notifications.md` and GDD §9 and §10 updated.
- **A short eye-check** after N1: the summary's new sections, and the order things appear on return.

## Not in this brief

The log (T-193). The ribbon art. The away summary's other details (brief 440).

## Owner to-do

The eye-check. No CMS work and no new art.
