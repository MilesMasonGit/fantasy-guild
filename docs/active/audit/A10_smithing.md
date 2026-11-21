# A10: Smithing, and making at stations
*Read at tag audit-build (1c04f5f6), 2026-11-20. This card holds the station rules shared by Smithing, Crafting (A11), Cooking (A12) and Alchemy (A14).*

## In one paragraph

A station runs the recipe the player picks, again and again forever: a hero
of the skill works it, the inputs are taken from the Bank (then floor loot)
when each cycle ends, and the outputs drop on the mat as loot. Every station
of a skill offers that skill's whole list (a Tannery is a Workbench, a
Furnace a Smithy); the better stations (Iron Furnace, Iron Smithy, Fir
Workbench) only work faster. Smithing has 34 recipes up to level 90 (ingots,
tools, weapons, armour); above 45 there are only ingots and pickaxes. Your
approved plan (one Blacksmith, Kitchen, Workshop, Apothecary per skill, no
effects on base buildings) isn't in data.

## What the player sees and does

- **Pick a recipe** from the station's list (sorted by level, the next two
  locked ones as "???"); the station repeats it until changed (changing
  restarts the cycle).
- **A hero works it** if they meet the recipe's level; below it, an access
  alert.
- **Missing inputs** pause the cycle (progress kept) with a yellow "Out of …"
  mark.
- **Outputs** drop beside the station as loot, collected by hovering,
  auto-collect or the 40-pile sweep.
- **Smithing stations**: Furnace, Copper Smithy (Construction 1); Iron
  Furnace (7), Iron Smithy (8), 30% faster.

## What really happens underneath

- **Duration and XP come from the recipe**; a station's own cycle time and
  XP fields are never read (all 12 s and 0).
- **Inputs are taken at the end**, Bank first, from anywhere on the mat;
  whichever station finishes first takes short stock.
- **Stations never wear out**: the recipe's "station charge cost" (1 each)
  is never spent; a context Token's charge cost isn't read; the Copper Anvil
  (a context Token) is asked for by no recipe.
- **No failure** (no content gives a fail chance), no Preservation or
  Refresh on making.
- **Retired station kinds** are still written on 55 recipes and narrow
  nothing.
- **Smithing gaps**: 6 to 15, 23 to 30, 45 to 60, 60 to 75, 75 to 90; above
  45 only ingots and pickaxes. Gold and Silver Ingots are used by nothing.
- **Order oddities**: the Iron Dagger at 16, the Iron Sword at 38; the Iron
  Pickaxe at 15 with the Iron Ingot; the Copper Woodaxe from ore.
- **The "faster station" boost** on the better stations (and the Cooking
  Pot) is their only difference.

## What the owner controls in the CMS

Each recipe: inputs, outputs, time, XP, level, station charge cost (no
effect), context tags. Each station: what it works as (skill), access level,
effects. Not in the CMS: no wear, no partial cycles, Bank before floor, no
base fail chance, two "???" previews.

## What it touches, and where it overlaps another system

- **Mining** (A6, done): every ore's smelt; **Combat styles** (done): weapons
  and armour (T-565, T-566, T-568).
- **Construction** (A13): the stations; **Equipment** (A29, done).
- **Fletching, Enchanting, Tailor** (T-572, T-577, T-578): bows, wands leave
  the Smithy.

## Where it differs from the GDD

- GDD §5: 25 recipes (117 in data); "each costs the station 1 charge" (no
  wear); one building per skill (Blacksmith, Kitchen, Workshop, Apothecary;
  none exist); the Copper Anvil.

## Try this (in the tagged build, with the QA panel)

1. **Build a Furnace**; pick Copper Ingot; watch it repeat; let the ore run
   out (the yellow mark).
2. **Build an Iron Smithy** beside it: the same list, faster.
3. **Open a Smithy's list** past level 45: only ingots and pickaxes.
4. Ask yourself: one building per skill, or many?

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

- Picking, repeat, restart → `src/systems/board/StationRecipe.js:19-21, 69-90, 108, 127-134`, `src/systems/board/RecipeResolver.js:148-150, 185`; list → `src/systems/board/RecipeList.js:22, 91-127`
- Inputs: check, end, Bank then floor → `src/systems/board/WorkCheck.js:138-143`, `src/systems/board/BoardRunner.js:265-293`, `src/systems/board/InputAllocator.js:23-25, 54-63`
- Outputs to the floor → `BoardRunner.js:293-297`; collection → `src/systems/board/SpriteLayer.js:520-550`
- No wear, charge cost unspent → `src/systems/core/wearRule.js:72`, `src/systems/board/Charges.js:216-219, 249`
- Station cycle time unread → `RecipeResolver.js:185`, `BoardRunner.js:779-782`
- Retired kinds → `src/config/registries/tokenConstants.js:142, 191-195`
- Faster station → `data/effects.json:889`
- Recipes → `data/tokenRecipes.json` (34 smithing)
- GDD → `docs/reference/GDD.md:194, 1036-1064`
