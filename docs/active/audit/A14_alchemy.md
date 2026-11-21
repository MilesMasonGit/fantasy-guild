# A14: Alchemy (rules only)
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Alchemy runs at the Alchemy Table (Construction 5) with two recipes, both
level 1: Birdwatcher and the Elixir of Ironskin. Audited for its rules only
(owner, 2026-11-19): it follows the station rules in [A10](A10_smithing.md).
Wild Lavender is an Alchemy node (12 XP).

## What really happens underneath

- **Rules**: the same as every station; no Alchemy-only rule exists.
- **Potions** last 10 fights (elixirs) or 10 cycles (drinks) (A33).
- **Planned**: poisons for Stealth weapons (T-587), the Shrimp Trawler
  Potion's buff (T-526), and the approved Alchemy plan
  (content_alchemy.md, 2026-11-04).

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

- Recipes → `data/tokenRecipes.json` (2 alchemy); Wild Lavender → `data/tokens.json`
