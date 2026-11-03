# Brief 400 — Detail pass: the Bank, and a background for every panel

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "4. Bank": read its list first;
the item numbers below are that list's, and the owner's wish is what counts. Tabs, tiles, Search,
Select and Sort: looked at, no change.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (frames, the icon rule),
GDD §5 and §14, [concept_progression_ledger.md](../concept_progression_ledger.md).

Code to start from (verify): `src/ui/components/drawer/BankDrawer.jsx`, `BankTab.jsx`, `ItemTip.jsx`,
`src/ui/components/base/PixelFrame.jsx`, `src/systems/inventory/InventoryManager.js`,
`src/systems/progression/` (`lifetimeOf`, used by the encyclopedia), `cms/src/`. The owner says "we've
done this before with sell options": look in git for the old sell control's amounts and slider, and
reuse what still fits.

## Phases

B1 to B3 in order on one branch; B4 alone, after B3.

| Phase | What | Tier |
|---|---|---|
| B1 | **A coloured pixel gradient behind every drawer and panel** (items 1, 2). Not plain black: "some sort of pixelated gradient", in hard pixel steps or dither, "different color gradients for each one so they look distinct". **As a starting point each takes its nav bubble's colour**: Bank gold, Shop green, Atlas and world panels blue, Settings red, Hall purple; the rest as you judge, and list them. Dark enough that text keeps its contrast. One shared piece with a colour per panel, no new art, a static picture with no per-frame cost. The owner adjusts at the look. | builder |
| B2 | **The item tooltip** (item 3). The name as a header, the count underneath, then types and tags. Keep what else it shows today only if the inspection window (B3) doesn't take it over; say what moved. Applies wherever the item tooltip shows. | builder |
| B3 | **The inspection window** (items 4, 5, 6). Clicking a tile opens a window at the bottom of the Bank: the item sprite shown larger, at a whole-pixel scale, "so it can be examined closely"; stats like lifetime collected (`lifetimeOf`); **Discard**, with amounts **1, 50 %, All, All −1, or a slider**. Discarded items are gone. Drag, Select and right-click keep working as they do; say how a click and a drag are told apart. | builder |
| B4 | **Using items** (items 7, 8). An item may have a **Use**, authored in the CMS: its drops. In the window, Use with the same amounts (1, 50 %, All, All −1, or a slider) **pays out at once, into the Bank, with no hero**. A full Bank must not lose items: reuse how loot behaves when there's no room, and say what happens. First use: the **Bird Nest**, by a **CMS change pack** for the owner to review (brief 200): the drops from today's "Search a Bird Nest", whose recipe retires. ⚠️ That removes a source of Crafting XP and a reason for an early station: check the Starter Camp and tutorial don't rely on it. ⚠️ **The ledger must read Use** as a source, or Bird Nest's seeds read as unreachable, and the encyclopedia must show it as a way to get them. **Expect WORK CHANGED** only if a scenario uses the recipe; explain it. | engineer |

## Done when

- Gate green (`TESTING.md`). B1 to B3: engine work **same**. B4's change accepted by the director.
- In the running game, named as verified: each panel's background; text readable on each; the tooltip;
  a tile's window with its large sprite and lifetime count; Discard at every amount; a Use at every
  amount, on a nearly full Bank too; tile dragging and Select unaffected.
- The ledger's reach still finds wheat seeds and the other seed routes; the pack passes the gate.
- `bench:draw --compare` once for the eye-check batch.
- GDD §5 and `UI_STYLE.md` updated.
- **One eye-check after B3**, with the colours to adjust; a short one after B4.

## Owner to-do

Review the Bird Nest pack in the CMS, then Sync on `main`. Further items with a Use are content, for
the content roadmap's sessions.
