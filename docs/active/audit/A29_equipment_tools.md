# A29: Equipment and tools
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Each hero carries a nine-cell loadout. Any item can sit in any cell; only a
cap per kind limits it (two hands, a hat, a chest, two trinkets, one food, one
drink, any number of consumables). Gear, weapons and tools are one copy per
hero, taken out of the Bank; food, drink, bait and arrows only point at the
Bank's shared stack. A tool is a key: the right kind at a high enough tier
lets the hero work a Token, and a better tool adds nothing else. Gear lends
its effects to the hero who wears it. Gear can be lost two ways: a break
chance (three Rusty items, 1 %) and a 10 % chance per piece when the hero
loses a fight.

## What the player sees and does

- **Equipping**: drag from the Bank to a hero (or their grid), or between
  heroes. Past a kind's cap, the first piece of that kind goes back to the
  Bank. A new weapon replaces the weapon held; a two-hander clears both hands.
- **Refusals**, as the player reads them: "is fighting", "Villagers cannot
  equip items", "Needs Melee 15" (the hero bar rewords it as "Melee skill too
  low. (12/15)"), "already equipped", "Every Copper Pickaxe you own is already
  in use", "No free slot in the loadout", "The Bank is full: Ana keeps the …".
- **Tools**: a gathering Token names the tool kind and lowest tier it needs (a
  tier 2 pickaxe for Iron); without it the hero gets the yellow alert and the
  Token a "tool needed" callout. A new game puts one of each starter tool in the
  Bank (copper pickaxe, woodaxe, sickle, rod, trap); new heroes arrive empty.
- **Breaking**: the hero says "Rusty Pickaxe broke!"; the piece is gone, and
  nothing replaces it. A broken weapon ends the hero's order; a broken tool
  leaves the order and the hero stands off the Token. The break chance is
  never shown anywhere.
- **Losing a fight**: each gear piece has a 10 % chance to be destroyed, and a
  quarter of the Bank's stack of each food and drink the hero carries is lost.
  The catch-up summary lists it; nothing says the chance beforehand.
- **Food** heals when the hero drops below a quarter of their health, one
  item at a time from the Bank (in a fight a meal costs a swing). **Drinks
  never heal**: a drink is drunk as a work cycle starts and lasts 10 cycles; an
  elixir lasts 10 fights.
- **Bait and arrows** are spent from the Bank, one per catch or shot; out of
  bait the hero fishes the basic pool, out of arrows the bow still shoots
  (both already ruled to stop the work: A8 and A16).

## What really happens underneath

- **Tools gate only**: a better tool gives no speed or yield; its only gain is
  a rule written on it (the Fine Fishing Rod's Keen Line). An item's tier is
  otherwise read only to sort the Bank. Fishing ignores tier: any rod works.
- **The first fitting tool or weapon in grid order is the one used**, so
  moving items in the grid can change which one swings.
- **Breaking rolls once per finished work cycle (failed ones too) for a tool,
  once per kill for a weapon**, not per swing. No durability, no repair.
- **The cap of 5 on one effect** (two pieces naming the same effect add, up to
  5 times its base) covers the whole loadout, not just trinkets. A perk naming
  the same effect is added on top, outside the cap.
- **An item's reach is ignored**: every item effect in the data says
  "nearby", which does nothing; the effect applies to the hero's own work.
- **Gear below its level lends nothing** and a weapon below it is not swung,
  but no item in the data asks a level yet.
- **A second, unused way to need a tool**: a neighbouring "tool Token"
  (`acceptedTokens`, "Acts as"). No Token uses it, but it still runs; 8 old
  tool effects in the library are referenced by nothing.
- **Data the game never reads**: the heal amount on 6 drinks (Water 1 to
  Limeade 30) and the Shrimp Trawler Potion (whose tooltip still says
  "restores 5"); `regen` and `restoreType` on 3 items.
- Two helper functions (an old "which weapon" and a slot check) are called by
  nothing.

## What the owner controls in the CMS

Each item's kind and loadout slot, hands (one or two), off-hand, styles,
damage, speed, damage type, resistances and damage cuts, rules (effects with a
scale), break chance, tool kind and tier and "starter", heal amount (food
only works), arrow and bait blocks. Each Token's tool need (kind, lowest tier).
Not in the CMS: the caps (code, raised by Hall stars), the 25 % health line for
eating, drink and elixir lengths (10), the defeat losses (10 % gear, 25 %
food), the cap of 5.

Data today: 14 tools (5 pickaxe tiers, 2 woodaxes, 2 sickles, 2 rods, a trap,
plus Rusty Pickaxe and Woodaxe), 13 weapons, 7 armour, 25 food, 6 drinks, 4
potions and elixirs, 2 arrows, 2 baits; **no trinkets** yet (two Hall stars
raise the trinket cap). No Token needs a tier 5 pickaxe. Unfinished content
is expected.

## What it touches, and where it overlaps another system

- **Effects** (S0): gear is one source summed with stars, buildings and perks,
  with its own cap of 5 that perks and buildings don't have.
- **Health, food and defeat** (A28): eating, drinks, elixirs, defeat losses.
- **Fishing** (A8) and **Ranged** (A16): bait and arrows, already ruled.
- **Telling the player** (done): "Needs [icon] Melee 15" (T-500), item tooltips
  list effects (T-499), "My axe broke!" as a speech bubble (T-496).
- **The Bank**: one copy per hero leaves the Bank; a full Bank refuses taking
  gear off.

## Where it differs from the GDD

- GDD: a full loadout with nothing of the item's kind refuses. Dropped on a
  chosen cell, the item takes that cell anyway (what was there goes to the
  Bank).
- GDD: "Needs Melee 15"; the hero bar says "Melee skill too low. (12/15)".
- GDD doesn't say drinks never heal, that tools add no speed or yield, that the
  cap of 5 covers the whole loadout, or that losing a fight can destroy gear.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give yourself a Copper Pickaxe, an Iron
   Pickaxe (tier 2), a Rusty Pickaxe, a Copper Sword, a Bow, a Copper Shield
   if you have one, a Leather Hat, an apple or two, a drink (Lemonade), and
   Copper Arrows.
2. **Equip a Copper Pickaxe and send the hero to an Iron vein.** You should
   see the yellow alert and "tool needed". Swap in the Iron Pickaxe: the hero
   starts.
3. **Compare the two pickaxes on a Copper vein**: the cycle time is the same
   (tools only unlock).
4. **Drop a second weapon on a hero holding a sword**: the sword goes back to
   the Bank. Then drop a hat on a cell holding food: the food leaves.
5. **Hover a pickaxe in the Bank**: no break chance, no "unlocks Iron" shown.
6. **Work a vein with the Rusty Pickaxe for a while**: about 1 in 100 cycles
   it breaks, "Rusty Pickaxe broke!", and the hero stops.
7. **Equip Lemonade and send a wounded hero to work**: the drink doesn't heal;
   food does once health drops under a quarter.
8. **Lose a fight on purpose** (a strong enemy, a weak hero): check the summary
   for lost gear and food.

## Owner feedback (2026-11-20)

Interviewed in three rounds without playing first.

- **Tools**: a better tool also works faster, by a Speed rule on each tool
  family with a scale per tier (as weapon families do), authored in the CMS.
  The hero uses the best fitting tool, not the first in the grid.
- **Losing gear**: both ways stay (the break chance on a few items, today the
  Rusty tools; the defeat loss). The break chance is shown on the item.
- **The same effect from several sources**: adds in full, no cap.
- **Item tooltip**: what a tool unlocks, and its break chance.
- **The old tool Token path**: retired.
- **Item reach**: the CMS doesn't offer one on an item's effect.
- **A drop on a chosen cell**: replaces what is there, to the Bank, as now;
  the GDD is fixed.
- **Drinks' ignored heal amounts**: decided in A28 Health, food and defeat.

## What it became

- **T-515**: better tools work faster (a Speed rule per tool family), and the hero uses the best one.
- **T-516**: the same effect from several sources adds in full, no cap.
- **T-517**: an item's tooltip says what a tool unlocks and its break chance.
- **T-518**: the neighbouring tool Token path and dead equipment code retired.
- **T-519**: an item's effect has no reach.
- **T-520**: equip refusals in one wording, translatable.
- **T-521**: GDD §4 Equipment matches the game.
- A28 Health, food and defeat: drinks' heal amounts and showing the defeat losses, in its STATUS row.
- A8 Fishing: rod tiers wait on the overhaul, in its STATUS row.
- Fine as is: defeat gear loss, a chosen cell replacing what is there.

All seven tickets blocked on the Effects group.

## Evidence

- Caps and categories → `src/config/registries/equipmentCategories.js:14, 39-68`; star raises → `src/systems/equipment/loadoutCaps.js:12-17`, `data/hallStars.json:2401-2404, 2449-2452`
- One copy per hero vs shared stack → `src/systems/equipment/heldCopies.js:7-22`, `EquipmentManager.js:189, 231`
- Refusals → `EquipmentManager.js:125-128, 180-193, 211-216, 105-107`; `EquipmentValidator.js:29-41`; hero bar rewords → `src/ui/components/dock/dockEquip.js:31-38`
- Past a cap, first of kind to the Bank → `EquipmentManager.js:35-47`; weapon replaces weapon, two-hander → `:54-83, 196-200`; chosen cell taken under the cap → `:201-208`
- Tools gate only, water exception → `src/config/registries/toolKinds.js:10-17, 104-109`; first fitting in grid → `src/systems/equipment/HeroTools.js:22-26, 73-83`; no tool alert → `src/systems/board/WorkCheck.js:60-68`, `Flags.js:294-297`; tier read for sort → `bankSort.js:49`
- Starter tools in the Bank once → `src/systems/equipment/StarterTools.js:34-52`; new hero empty → `HeroGenerator.js:59`
- Tool Token path unused → `src/systems/board/RecipeResolver.js:77-92, 133`
- Breaking: per cycle and per kill → `src/systems/equipment/Breakage.js:57-73`, `BoardRunner.js:469-470`, `BoardCombat.js:529-531`; destroyed → `Breakage.js:21-22, 49`; said → `HeroBubbleLayer.jsx:118-121`; weapon ends order → `Flags.js:811-818`
- Defeat losses → `src/systems/combat/DefeatPenalties.js:33-51`, `src/config/loopConstants.js:89-91`
- Cap of 5 across the loadout → `src/systems/hero/HeroEffects.js:84-91`, `effectLibrary.js:23`; perks outside it → `HeroEffects.js:238-245`
- Item reach ignored → `src/systems/board/TileModifiers.js:1099-1104`
- Below level lends nothing → `HeroEffects.js:55`, `CombatFormulas.js:50-57`
- Eating → `ConsumptionSystem.js:48-51, 79-111`, `loopConstants.js:54`; drinks and elixirs → `consumableRule.js:70-75`, `ConsumptionSystem.js:196-309`
- Unread heal, regen, restoreType → `ConsumptionSystem.js:84`; tooltip → `ItemTip.jsx:99`
- Bait, arrows from the Bank → `src/systems/board/Fishing.js:21-23, 41-52`, `src/systems/combat/Arrows.js:14-20`
- Data counts → `data/items.json` at the tag (14 tools, 13 weapons, 7 armour, 25 food, 6 drinks, 4 potions; no trinket slot; 3 break chances; no level asks)
