# A7: Forestry
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A hero with a woodaxe fells trees for wood (1 to 2 a cycle) and sometimes a
seedling (20%). Seven woods climb from Oak (level 1) to Ebony (90). Only oak
and fir wood are used by anything: birch, maple, cedar, mahogany and ebony
wood have **no recipe, shop or quest at all**, so Forestry past level 15 is a
dead end. The Iron Woodaxe does nothing (every tree asks the copper one), and
the numbers wander (uses 5, 100 or 1000; Ebony gives 2185 XP a cycle). The
tree cycle itself was settled in A2: Forests plant full Trees, Stumps grow
back with their Forest, every wood gets a Forest (T-596, T-597).

## What the player sees and does

| Tree | Level | Cycle | Uses before a Stump | XP |
|---|---|---|---|---|
| Oak | 1 | 3 s | 5 | 3 |
| Fir | 15 | 19 s | 5 | 5 |
| Birch | 30 | 23 s | 100 | 7 |
| Maple | 45 | 26 s | 100 | 8 |
| Cedar | 60 | 29 s | 1000 | 12 |
| Mahogany | 75 | 33 s | 100 | 39 |
| Ebony | 90 | 36 s | 100 | 2185 |

- **Woodaxes**: Copper (starter), Iron (tier 2), Rusty (breaks). No higher
  axes, though pickaxes go to tier 5.
- **Seedlings** come from their own tree (and Oak's from the Bird Nest);
  they pay for Forest planting, Stump regrowth and building Forests. Cedar
  and Ebony seedlings have no use.
- **The Logging Camp** is a Forestry camp; Hall stars speed felling and
  growth; the level 10 perk is Clean Felling.

## What really happens underneath

- **Wood with no use**: oak wood has 43 recipes, fir 8; the other five woods
  none.
- **Tool tier only gates**, and every tree asks tier 1; the approved Mining and
  Forestry roadmap says better trees need better axes, not in data.
- **Levels** are the old 15-step ladder (1, 15, 30 …), not the 20-level tiers
  the content rules use.
- **Ebony's 2185 XP** matches the Darkmetal Vein's figure: likely a copy slip.
- **Tags missing**: Birch, Cedar and Ebony Trees have none, the Maple Tree
  lacks "Maple", so a Forest's boost by tag would miss them.
- **Map trees can't be cleared** until felled (only Forests and Stumps are
  clearable).
- **The Copper Woodaxe** is made from ore and coal; every other tool from
  ingots.
- **Seedling sell values** look generated and huge (Ebony Seedling 4094).

## What the owner controls in the CMS

Each tree: level, cycle, uses, outputs, tool tier, XP, tags, clearable; the
seedlings; the Logging Camp; recipes. Not in the CMS: tier gates only.

## What it touches, and where it overlaps another system

- **Spawners** (A2, done): the tree cycle and Forests (T-596, T-597).
- **Equipment** (A29, done): tools faster by tier (T-515).
- **Construction and Crafting** (A13, A11): where wood goes.
- **Events** (A4, done): the Fallen Maple gives maple wood, which has no use.

## Where it differs from the GDD

- GDD: Oak Sapling to Tree 30 s (150 s); "Oak Seed" (Oak Seedling); "no
  shipped Token uses" Grow Time or the Forest gate (oak and fir do); the
  Stump grows into a Sapling (being changed, T-596).

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game; QA panel: a hero at Forestry 30, an Iron Woodaxe;
   place a Birch Tree.
2. **Fell oak**, then **birch**: compare times and drops.
3. **Search the Bank's recipes for Birch Wood**: nothing uses it.
4. **Swap Copper and Iron Woodaxes**: no difference.
5. Ask yourself: what should each wood be for?

## Owner feedback (2026-11-20)

Interviewed together with the Gathering group, without playing first.

- **The approved plans**: build all four now; the Fishing plan amended first
  to the rulings.
- **Items with no use**: every gathered item has a job.
- **Tool tiers**: better nodes need better tools, and better tools are
  faster.
- **Uses**: "One rule, generally going to be around 5."
- **A resting vein**: its own picture, no message.
- **No seed**: the hero says so, like bait.
- Leftovers filed as offered.

## What it became

- **T-622** (planning agent, content agent): build the Fishing plan, amended first.
- **T-623** (director): no fishing without bait.
- **T-624** (content agent): build the Mining and Forestry plan; tools gate.
- **T-625** (content agent): build the Farming plan.
- **T-626** (planning agent, content agent): every gathered item has a job.
- **T-627** (planning agent, content agent): nodes run out after about five uses.
- **T-628** (director; owner art): a resting vein has its own picture.
- **T-629** (director): no seed, the hero says so.
- **T-630** (content agent; director): gathering leftovers.
- **T-631** (planning agent): GDD on gathering.

All ten tickets cover the whole Gathering group, blocked on it; the group is ready to brief.

## Evidence

- Trees → `data/tokens.json` (`token_oak_tree` 232 … `token_ebony_tree` 2119; config skillRequired, cycleTimeMs, uses, xp, outputs)
- Old Forest nodes → `data/tokens.json:1785, 1897, 2069`
- Woodaxes → `data/items.json:1323, 2139, 2824`; recipes → `data/tokenRecipes.json:80, 735`
- Tool tier gates only → `src/config/registries/toolKinds.js:13, 108`
- Wood uses → `data/tokenRecipes.json` (no recipe names birch, maple, cedar, mahogany or ebony wood)
- Seedlings → `data/items.json:999-1200`; Starter Camp → `data/starterCamp.json:100-101`
- Logging Camp, stars, perk → `data/tokens.json:5981`, `data/hallStars.json:94-300`, `data/skillPerks.json:12`
- Clearable → `src/systems/board/Demolition.js:110`
- Roadmap → `docs/active/content_mining_forestry.md:23`
- GDD → `docs/reference/GDD.md:181, 277, 284, 295`
