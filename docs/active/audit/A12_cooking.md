# A12: Cooking
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Cooking runs at a Cooking Pot or a Brewery (Construction 1); a Campfire and
Grandma's Kitchen exist but can't be got. Sixteen recipes, levels 1 to 35:
foods and drinks. Nothing asks above 35. The station rules are in
[A10](A10_smithing.md).

## What really happens underneath

- **Grandma's Kitchen never works**: it has no work setup at all, so a hero
  can't use it; it can't be got anyway (no build, shop or map), nor can the
  Campfire.
- **Odd levels**: Cooked Trout, Lavender Salmon and Grape Juice at 35 (trout
  is the commonest fish), Shrimp and Steak at 1; nothing from 36 to 99.
- **The Cooking Pot** carries a 15% faster boost, against your plan's "base
  buildings carry no effect".
- **Twelve fruits** have no recipe (T-626).
- The approved Food and Drink plan (content_food_and_drink.md) isn't in
  data.

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

- Recipes → `data/tokenRecipes.json` (16 cooking); Grandma's Kitchen config null → `data/tokens.json` (`token_grandma_s_kitchen`), `src/systems/board/StationRecipe.js:130`
