# A6: Mining
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A hero with a pickaxe works a vein for ore (1 to 2 a cycle); after its uses
the vein rests and refills all at once, staying where it stands. Eleven
nodes run from Copper, Coal and Stone (level 1) to Darkmetal (90); each ore
feeds one Smithing smelt. Mines (Copper Mine, Coal Mine, Quarry) stand on
stone and give their ore a 25% double chance nearby; the Quarry also spawns
Stone Outcrops; a Minecart speeds copper only. It works, but: resting is
silent and a resting vein looks exactly like a Stone Outcrop; uses jump from
5 to 1000 (so high veins barely rest); quartz and clay have no use; no node
drops gems; the Darkmetal Pickaxe gates nothing.

## What the player sees and does

| Node | Level | Cycle | Uses, then rest | Pickaxe | XP |
|---|---|---|---|---|---|
| Copper, Coal, Stone | 1 | 3 to 4 s | 5, 60 s | 1 | 1 |
| Quartz, Clay | 1 | 16 s, 25 s | 500, 120 s | 1 | 2 |
| Iron | 15 | 19 s | 5, 90 s | 1 | 5 |
| Silver | 30 | 23 s | 1000, 120 s | 2 | 7 |
| Gold | 45 | 26 s | 1000 | 2 | 7 |
| Mythril | 60 | 29 s | 1000 | 2 | 11 |
| Adamantium | 75 | 33 s | 1000 | 3 | 37 |
| Darkmetal | 90 | 36 s | 1000 | 4 | 2185 |

- **Pickaxes**: Copper to Darkmetal, tiers 1 to 5 (Smithing 2 to 90), plus a
  Rusty one. Tier only gates; nothing asks tier 5.
- **A resting vein** shows a countdown; heroes with nothing else wait
  ("Waiting for Copper Vein") and work it the moment it refills.
- **Mines**: Copper Mine, Coal Mine, Quarry, built on an Excavation, standing
  on stone; the Coal Mine needs a Coal Prospecting Map (Goblin drops). A
  Minecart (on a Wood Foundation) speeds copper veins only. The Scrap Heap
  (starter) drops rusty tools. Comets come as events.

## What really happens underneath

- **Resting is silent**: the game announces it but nothing listens.
- **The resting picture** is the Stone Outcrop's own picture.
- **Uses**: 5 for the common ores, 500 for quartz and clay, 1000 from silver
  up, so a high vein almost never rests.
- **No gems**: no node drops one; quartz is the only Gem-tagged item and has
  no use; clay neither (A34 already asks the content agent for mining rare
  tables, T-553).
- **Supports stop at copper, coal and stone**: iron and up have no Mine or
  Minecart.
- **XP off the curve** (Adamantium 37, Darkmetal 2185 against Mythril 11).
- **Leftovers**: a duplicate Adamantine vein (no skill, 726 XP, not in the
  world, yet the ore's value comes from it); unused pickaxe effects; the
  Coal Mine and Quarry wear minecart pictures.
- **The approved roadmap** (content_mining_forestry.md, 2026-11-04) plans
  metals 20 levels apart, a Geode for gems, a Fallen Star and a Fossil Bed;
  none in data.

## What the owner controls in the CMS

Each node: level, cycle, uses, rest, resting picture, outputs, pickaxe tier,
XP, Stands on; Mines' and the Minecart's effects; the pickaxes. Not in the
CMS: tier only gates; a refill is all at once.

## What it touches, and where it overlaps another system

- **Smithing** (A10): every ore's smelt.
- **Winning and loot** (A34, done): rare tables (T-553).
- **Equipment** (A29, done): tools faster by tier (T-515).
- **Regions** (A40, done): stone terrain; **Spawners** (A2, done): the Quarry.
- **Telling the player**: the silent rest.

## Where it differs from the GDD

- GDD's spawner table: Copper and Coal Mines spawn veins; they don't.
- GDD: "no shipped Token uses" refills; every vein does.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game (copper and coal veins, a Copper Mine).
2. **Mine a copper vein five times**: it rests with no word; compare it with
   a Stone Outcrop.
3. **Place a Silver Vein** (QA panel): count how long before it rests.
4. **Search recipes for Quartz or Clay**: nothing.
5. Ask yourself: what should rest, how often, and what should gems be for?

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

- Nodes → `data/tokens.json:2, 717, 766, 873, 2178, 2229, 2280, 2331, 2383, 2480, 2774`
- Pickaxes → `data/items.json:1217-1302`; tier gates only → `src/config/registries/toolKinds.js:13`, `src/systems/core/toolRule.js:38`; unused effects → `data/effects.json:2-281`
- Mines, Minecart → `data/tokens.json:94, 2825`, `data/effects.json:964, 1042`, `src/systems/board/OutputRules.js:64`; stone only → `src/systems/board/MatPlacement.js:240-242`, `src/systems/board/SiteRules.js:65`
- Rest silent → `src/systems/board/Respawn.js:26-29, 118` (no listener outside tests); refill → `:138-149`; waiting → `src/systems/board/Flags.js:883`
- Quartz, clay unused → `data/tokenRecipes.json`
- Duplicate vein → `data/tokens.json:2434`, `data/items.json:720`
- Roadmap → `docs/active/content_mining_forestry.md`
- GDD → `docs/reference/GDD.md:280, 320, 340-360`
