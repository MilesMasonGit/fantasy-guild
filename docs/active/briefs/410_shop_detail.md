# Brief 410 — Detail pass: the Shop and the Foundations

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "5. Shop": read its list and its
Foundation table first; the item numbers below are that list's, and the owner's wish is what counts.
Buying gets no effect or sound: looked at, no change.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, GDD §3 (Foundations), §5 and
§9, [concept_progression_ledger.md](../concept_progression_ledger.md), `ui_rework_list.md` ("Shop
groups and Foundation tiers", "Shop UI"; amended by this brief).

Code to start from (verify): `src/ui/components/drawer/ShopDrawer.jsx` (and `ShopPanel.test.js`,
`DrawerEdge.test.js`, `DragRedrawsDrawers.test.js`), `src/ui/components/board/Board.jsx`,
`src/ui/hooks/useUIModals.js`, `src/ui/ReactRoot.jsx`, `src/systems/board/Shop.js`,
`src/config/registries/tokenConstants.js` (`FOUNDATION_KINDS`),
`src/config/registries/recipePoolRegistry.js`, `cms/src/components/editors/LifecycleBlocks.jsx`,
`RecipeEditor.jsx`, `src/ui/components/base/EntityRibbon.jsx`, `src/systems/quests/tutorialQuests.js`.

## Needs

- Brief 400 B1's green gradient: whichever runs second keeps it on the new panel.
- S2 needs S1's pack synced by the owner, so the cards have their icons and order to show.
- Art is not needed to finish: stand-ins below; swap when the owner draws them.

## Phases

| Phase | What | Tier |
|---|---|---|
| S1 | **The Foundations** (items 2, 4, 5, 6). **Code**: add `excavation` and `battlefield` to `FOUNDATION_KINDS`; a Token's `shop` block gains the skill icons it shows and its place in the list, both authored in the CMS. Icons are authored, not worked out from recipes: they "generally guide", and several buildings have no skill. **A CMS change pack** (brief 200) for the owner to review, following the concept's table: new Tokens Excavation (stand-in `t_foundation_granite`) and Battlefield (stand-in `t_foundation_basalt`); Copper Mine, Coal Mine and Quarry move to Excavation; every enemy spawner built from a banner moves to Battlefield; Mining Camp moves from Stone to Wood; `shop` blocks come off Coast and Goblin Camp; list order Wood, Stone, Farmland, Excavation, Battlefield; icons as in the table, Faith's included though it has no building yet. **Prices are placeholders**: ⚠️ Excavation can't cost Stone, since the first Quarry is what gets you stone, so Oak Wood only. Battlefield Oak Wood too. ⚠️ **Reach**: the pack passes the gate and the ledger still finds everything: the first Quarry, mines, stone, the first lure, Coast and Goblin Camp through the Starter Camp and world tables; stop and report any Token left with no way to get it. ⚠️ A save may hold a Foundation already building a moved recipe: say what it does, and it must not get stuck. **Expect WORK CHANGED** if a scenario buys Coast or Goblin Camp or builds a mine on Wood; explain it. The tutorial's Wood Foundation and Workbench stay as they are; check them. | builder |
| S2 | **The pop-up Shop** (items 1, 3, 7). **It rises from the bottom over the hero bar**, beside the nav and on either menu side, replacing the left drawer. **A row of cards side by side**, each a fixed size: name, the Token sprite large, then skill icons, then costs underneath (2 x 2 at most, in the shorthand counts, T-301). Our arrow buttons left and right, no scroll bar. **No skill headings.** The whole card is the drag handle, and a group keeps its dropdown. **Dragging**: the panel drops to a lip at the bottom while over the mat and comes back when over it, as the drawer does sideways today; a drop on the panel is a cancel; it stays open after a purchase, so several can be bought. **Can't afford**: the red short amounts only, the sprite dimmed, the "Need" line gone; a full Token cap keeps its message. **Hover**: a skill icon names the skill; a card lists what the Foundation builds. Retire `shop.section` from the Shop and the CMS once nothing reads it. Escape, the Bank and other panels behave as they do with today's drawer; the Bank stays a drawer. Tests are moved, not dropped. This is drag code, so it goes in the drag bench queue. | builder |

S1 first, then S2 after the owner's Sync. Not beside another WORK CHANGED.

## Done when

- Gate green (`TESTING.md`). S1's WORK CHANGED accepted by the director; S2's engine work **same**.
- In the running game, named as verified: a new game reaches its first Quarry and first Goblin Camp;
  the tutorial's Foundation step; each Foundation's build list; the panel open at 1366 and 1920 and
  on both menu sides; a purchase by drag; a cancel on the panel; the lip; buying twice without
  reopening; an unaffordable card; a full cap; a hover on an icon and on a card.
- The ledger's reach and checks pass with the five Foundations; report any stage budget that moves.
- Ready for bench: `bench:drag` and `bench:draw --compare` for the eye-check batch.
- GDD §3, §5, §9, `UI_STYLE.md` and `ui_rework_list.md` updated; the GDD's stale list of ten Tokens goes.
- **One eye-check after S2**: panel height and card size are the owner's to tune. S1 needs only the
  pack review.

## Not in this brief

The audit of item counts across the game (T-301). Prices: the balance pass. Foundation tiers (Oak,
Maple, Ebony and so on): the dropdown stays ready, the content comes from the content roadmap.

## Owner to-do

Review the Foundations pack in the CMS, then Sync on `main`. Draw the Excavation and Battlefield
Foundations when ready (`owner_art_list.md`).
