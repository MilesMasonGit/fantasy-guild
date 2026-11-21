# A9: Farming
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A Field (or Herb Garden, or the starter's Wild Wheat Patch) grows the crop
the player picks: it sows itself, grows for an hour or more, then gives up to
10 harvests that a hero with a sickle cuts, and re-sows. Only two crops exist
(Wheat, Lavender). Fruit trees and berry bushes are picked and rest like
veins; an Orchard plants apple trees. Nearly everything is level 1 (only the
Grapevine asks 15), so Farming has no climb; twelve fruits and berries have
no recipe at all; the approved Farming roadmap (38 unlocks, no sickle) isn't
in data yet.

## What the player sees and does

- **Fields**: pick Wheat or Lavender; the Field sows (the seed is checked then,
  paid at the first harvest), grows (1 h wheat, 1.5 h lavender), ripens, a
  hero harvests 10 (8) times, it re-sows. While it grows the hero moves on and
  waits for it. With no seed the Field shows a yellow mark "Needs Wheat Seed
  to sow"; the hero just goes idle.
- **Seeds**: Wheat Seed from wheat (40%), the Hall (1 per 5 minutes) and the
  Bird Nest; Lavender Seed from lavender and frogs; Apple Seed from apples
  and the Hall; Grape Seed only from Grapevines.
- **Fruit and berries** (Redberry with thorns, Blackberry, Raspberry,
  Blueberry, Strawberry, Pineapple, Apple, Cherry, Lemon, Lime, Orange,
  Peach, Banana, Coconut, Watermelon, Grapevine): picked, rest, fruit again;
  placed by the world, no seed or building (Apple and Grapevine aside).
- **Supports**: Well (crops grow 9% faster), Composter (+1 harvest),
  Beehive (honey and wax; 9% double wheat), Windmill (flour), Apple Orchard
  (plants apple trees, faster fruiting). Events: Rainfall, Warm Sun.

## What really happens underneath

- **No climb**: everything is level 1 except the Grapevine (15); nothing
  unlocks from 2 to 99. The Grapevine can be built at Construction 5 but not
  worked until Farming 15.
- **Twelve crops with no recipe**: redberry, blackberry, raspberry,
  blueberry, strawberry, pineapple, cherry, orange, peach, watermelon,
  banana, coconut (eaten only); Lemon and Lime are typed material, so not
  even eaten.
- **Sickles**: the roadmap says they go; five Tokens still ask one.
- **The Beehive's boost** reaches wheat only, not lavender.
- **Wild apple trees** never refill without an Orchard near.
- **Wild Lavender** is an Alchemy node (12 XP) while the Lavender crop is
  Farming (1 XP).
- **Broken**: the Blackberry Bush gives 0 berries and has an empty bonus
  drop. Ripe Wheat is reachable only from the orphan Wheat Sprout (T-600).
- **The Farmstead's** written reach (320) is never read.

## What the owner controls in the CMS

Fields and Herb Gardens (station kind, pictures), crop recipes (seed, grow
time, harvests, outputs), fruit Tokens (uses, rest, needs an Orchard), the
supports' effects. Not in the CMS: the seed paid at the first harvest.

## What it touches, and where it overlaps another system

- **Cooking, Alchemy** (A12, A14): where crops go.
- **Spawners** (A2, done): the Orchard plants full trees (T-596).
- **Winning and loot** (A34, done): Giant Harvest for Farming only (T-551).
- **Events** (A4, done): Rainfall, Warm Sun, Berry Thicket.
- **Fishing** (A8): worms from wheat and lavender.

## Where it differs from the GDD

- GDD: "no content yet"; crops by level (none to show); the Beehive doubles
  "the crop" (wheat only).

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game (Wild Wheat Patch). QA panel: Wheat Seeds, a
   Farmland, a Composter.
2. **Watch the patch** sow, grow, ripen; harvest with the sickle.
3. **Build a Field**, pick Lavender with no Lavender Seed: the yellow mark.
4. **Pick a Blackberry Bush**: nothing comes out.
5. Ask yourself: what should a Farming level unlock, and what are all the
   fruits for?

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

- Fields → `data/tokens.json:516, 3426, 3472`; crops → `data/tokenRecipes.json:2314, 2377`
- Cycle: pick, sow, grow, harvest, re-sow → `src/systems/board/Fields.js:124-132, 160-173, 201-217, 240-243, 258, 283-308`
- No seed: hero idle, Field mark → `src/systems/board/WorkCheck.js:28, 37`, `src/ui/components/board/problemMark.js:35, 164`
- Fruit Tokens → `data/tokens.json:652, 957 (Blackberry, 0 out), 1004-1579`
- Seeds → `data/tokenRecipes.json:1954`, `data/tokens.json` (Hall trickle)
- Supports → `data/effects.json:1067, 1092, 1117, 1143`, `data/tokens.json:562, 3565`
- Crops with no recipe → `data/tokenRecipes.json`; Lemon, Lime material → `data/items.json`
- Sickles in data vs roadmap → `data/tokens.json` (`needsTool` sickle), `docs/active/content_farming.md:10, 35`
- Wild apple trees need an Orchard → `src/systems/board/Respawn.js:65-78`
- GDD → `docs/reference/GDD.md:446-511`
