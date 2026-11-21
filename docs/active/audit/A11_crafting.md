# A11: Crafting
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Crafting runs at a Workbench (Construction 1), a Fir Workbench or a Tannery
(6); a Ceramics Kiln exists but can't be got. Eleven recipes, levels 1 to
21: charcoal, a torch, bait, fishing rods, the trap, the Bird Nest search,
leather and leather armour. The station rules are in [A10](A10_smithing.md).

## What really happens underneath

- **The Leather Hat** asks Crafting 15 but needs Leather, made at 20.
- **The Torch** is made and used by nothing.
- **Eight recipes** name no station kind (harmless: kinds are retired).
- **The Ceramics Kiln** has no build, shop or map: only the QA panel
  places it.
- **Copper Nails** (Smithing) feed no build.
- The approved Crafting plan (content_crafting.md, 2026-11-04) isn't in
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

- Recipes → `data/tokenRecipes.json` (11 crafting); Ceramics Kiln → `data/tokens.json` (no build or shop)
