# A5: The Shop
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

The Shop sells five Foundations, paid in items (Oak Wood, Stone), never
coins: there is no money in the game. Drag a card onto the mat to buy; an
unbuilt Foundation dragged back returns its price. Everything is on sale from
the start. Nothing can be sold. Items carry a "value" the CMS works out for
balancing, but the game never uses it.

## What the player sees and does

- **Five cards**: Wood Foundation (15 Oak Wood), Stone (10 Stone + 5 Oak
  Wood), Farmland (10 Oak Wood), Excavation (15 Oak Wood), Battlefield (15
  Oak Wood), each with skill icons hinting at its use.
- **Buy**: drag a card onto the mat; paid from the Bank first, then floor
  loot; blocked when you can't afford it or the mat is full.
- **Refund**: drag an unbuilt Foundation back.
- **No selling**, and no coins anywhere.

## What really happens underneath

- **Item value** (85 items) is written by the CMS simulator; the game reads
  it nowhere, only the Encyclopedia reads where an item comes from.
- **Coins** exist as an item nothing makes or spends.
- **The Shop's section field** isn't used by the Shop; it only heads the Token
  Summary, which is why the Battlefield shows under "Melee" (T-570).
- **The Stone Foundation shows a Faith icon**, though nothing builds a Faith
  building.
- **Groups** (cards folded into one) exist, unused.

## What the owner controls in the CMS

The Token's Shop block: price, section, group, skill icons, order. Not in the
CMS: drag to buy, all on sale from the start, the full-price refund.

## What it touches, and where it overlaps another system

- **Placing and removal** (A1, done): refunds, the cap.
- **Construction** (A13): what Foundations build.
- **Items and the Bank** (A36): no selling.

## Where it differs from the GDD

- GDD: Excavation and Battlefield "arrive with the owner's Sync"; they're in.

## Try this (in the tagged build)

1. **Open the Shop**: five cards.
2. **Buy a Farmland** by dragging; drag it back: the price returns.
3. **Look for a Sell button** in the Bank: none.
4. Ask yourself: should the Shop ever sell more than Foundations, or buy
   things from you?

## Owner feedback (2026-11-20)

Interviewed together with the Making group, without playing first.

- **The approved making plans**: build them all now (one building per skill
  with its variants).
- **Campfire, Ceramics Kiln, Grandma's Kitchen, Fighter's Academy**: retire
  all four.
- **Construction 10 to 99**: building variants up the levels.
- **The Shop**: keep it, items only, no selling.
- Leftovers filed without asking.

## What it became

- **T-632** (content agent; director): build the making plans, one building per skill.
- **T-633** (content agent; director): retire four stations.
- **T-634** (content agent): Construction climbs to 99.
- **T-635** (director; content agent): making leftovers.
- **T-636** (planning agent): GDD §5 Making and the Shop.
- Fine as is: the Shop sells Foundations for items; no money, no selling; outputs drop as loot.

All five tickets cover the whole Making group, blocked on it; the group is ready to brief.

## Evidence

- Shop → `src/systems/board/Shop.js:27, 107, 192-236`; drag to buy → `src/ui/components/board/dropOnMat.js:116-120`
- Shop blocks → `data/tokens.json` (five Foundations)
- No selling → `src/ui/components/drawer/BankTab.jsx:218`
- Value written by the CMS, unread → `cms/src/engine/sim/writeBack.js:235-247`; Encyclopedia reads the source → `src/ui/components/encyclopedia/encyclopediaChart.js:126-128`
- Coins unused → `data/items.json` (`item_coins`)
- Section only for the summary → `src/ui/components/board/MatCapBadge.jsx` (`sectionOf`)
