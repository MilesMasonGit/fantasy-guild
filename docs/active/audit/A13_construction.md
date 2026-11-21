# A13: Construction
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Construction is the skill that turns a Foundation into a building: 51 build
recipes over five Foundation kinds, each a hero's cycle that takes its
materials at the end and pays XP. It is the only way Construction XP comes
in (demolition pays none, until T-610). It stops at level 10: 34 builds are
level 1, the rest 5 to 10, and nothing asks more. Your approved Construction
plan (4 November: one Blacksmith, Kitchen, Workshop, Apothecary, variants,
no effects on base buildings, cost tiers) is almost entirely unbuilt.

## What the player sees and does

| Foundation | Builds | Levels |
|---|---|---|
| Wood | Workbench, Cooking Pot, Brewery, Windmill, Composter, Beehive, Dock, Minecart, the four camps; Alchemy Table (5); Fir Workbench, Tannery (6) | 1 to 6 |
| Stone | Furnace, Copper Smithy, Well, Fighter's Academy (1); Iron Furnace (7), Iron Smithy (8) | 1 to 8 |
| Farmland | Field, Apple Orchard, Oak Forest (1); Herb Garden, Fir Forest, Grapevine (5); Birch, Maple, Mahogany Forests (10) | 1 to 10 |
| Excavation | Copper Mine, Coal Mine (needs a map), Quarry | 1 |
| Battlefield | 18 enemy camps from a banner and 5 Oak Wood | 1 and 5 |

- Builds take 30 s to 4 minutes; no tool; the level 10 perk is Quick
  Builder (5% faster).

## What really happens underneath

- **No climb past 10**: nothing gates at 2 to 4, 9 or above 10.
- **Built but unworkable**: the Grapevine (Construction 5, needs Farming
  15) and the Birch, Maple and Mahogany Forests (Construction 10, need
  Forestry 30 to 75); the three Forests are rest-and-refill nodes, not
  spawners (T-597 changes them).
- **The Fighter's Academy** is still buildable though promotion is retired.
- **The plan's "base buildings carry no effect"** is broken by the Cooking
  Pot (+15% faster) and the old faster tiers (Iron Furnace, Iron Smithy, Fir
  Workbench).
- **Unused**: Copper Nails (no build uses it), no Oak Plank, Foundation tiers
  and the "bench" kind.
- **Placeholder text** on every Foundation and the Grapevine; the Wolf Den
  wears a fallen-oak picture.

## What the owner controls in the CMS

Each build recipe: Foundation kinds, level, time, inputs, XP; each
Foundation's kind and skill; the perk. Not in the CMS: no tool for builds.

## What it touches, and where it overlaps another system

- **Placing and removal** (A1, done): Foundations, demolition XP (T-610), a
  builder staying (T-608).
- **Spawners** (A2, done) and **Gathering** (done): Forests, Mines.
- **The Shop** (A5): Foundations are its only goods.
- **Smithing, Crafting, Cooking, Alchemy**: their stations.

## Where it differs from the GDD

- GDD: a build is 30 s at level 1 (30 s to 4 minutes, levels 1 to 10).

## Try this (in the tagged build, with the QA panel)

1. **Buy a Stone Foundation** and look at its build list.
2. **Build a Fighter's Academy**: what does it do?
3. **Build a Grapevine** with a Farming 1 hero: they can't work it.
4. Ask yourself: what should Construction levels 10 to 99 bring?

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

- Recipes, levels, times → `data/tokenRecipes.json` (51 with skill construction)
- XP from builds → `src/systems/board/BoardRunner.js:400-405`, `src/systems/board/StationRecipe.js:128-141`; demolition 0 XP → `src/systems/board/Demolition.js:47-54`
- Perk → `data/skillPerks.json`, `data/effects.json`
- Cooking Pot effect → `data/tokens.json` (`effect_faster_station`)
- Foundation tiers unused → `src/config/registries/tokenConstants.js:118`
- Plan → `docs/active/content_construction.md`
