# A40: Regions
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Each place the guild settles is a Region: its own mat, Tokens, ground and
floor loot. The guild is in one Region at a time; the Bank, heroes, guild
upgrades, the one Guild Hall (which travels), quests and the event clock are
shared. A Region the guild has left **stands still**: nothing on its mat
grows, refills, spawns or works, even while you're away, and it carries on
exactly where it stopped when you return. Heroes' own clocks (wounds, buffs,
regen) and bounties keep running. A Region's ground (grass, rock, sand,
water, stone) comes from its biome and decides where a few Tokens may stand.
Biomes don't change yields, and Region rules exist in code with no content.

## What the player sees and does

- **Travel** to another settled place (the world map, A39): the Hall and the
  bounties come along; floor loot is banked on leaving (what doesn't fit stays
  on that floor).
- **Coming back**: everything stands as left; half-done work starts again
  from zero; fights are over and enemies back at full health.
- **A Region's look**: its name (renamable), a banner and ground look by its
  main biome, its share of grounds, the Token count against the shared 128,
  its playtime.
- **Ground**: a mine and a quarry stand only on stone, the Fish Shoal only on
  water; everything else stands anywhere dry.

## What really happens underneath

- **Frozen while away from it**: growth, crops, refills, spawners, work,
  fights, event Tokens and their buff time, floor loot. **Still running**:
  game time, hero effects and statuses, regen, wounds, bounties, the event
  clock.
- **Five biomes reachable in play** (mountain, forest, meadow, bog, coast,
  from the world's five kits); four more (flower meadow, cherry grove,
  Yellowstone, volcano) exist with ground and looks but only in dev maps.
- **Biome doesn't touch play**: no yields change; events can be limited by
  biome but none is; a node remembers its biome and nothing reads it. What a
  place offers comes from the world's lines and kits (which Tokens, camps,
  stone).
- **Region rules**: a Region can carry "provides" rules for the guild while
  there, but no place ever gets one; only a dev map does.
- **"Stands near"** rules exist with no content.
- **Leaving a Region for good**: archive, restore and abandon exist in code
  with no button.
- **No limit** on how many Regions in the Atlas itself.

## What the owner controls in the CMS

`world.json`: lines and origins, kits (biome, stone, work balance, camps),
ring camps, arrivals, extras, prices, wild layouts; Token "Stands on" and
"Stands near"; event biomes and ground; the Starter Camp. Not in the CMS: the
ground kinds and words, the biome table and water, every look, the banners.

## What it touches, and where it overlaps another system

- **The world map and settling** (A39): travel, arrivals, sleeping camps.
- **Time away** (A41): only the current Region catches up.
- **Events** (A4, done): biome filter, one shared clock.
- **Placing** (A1, done): ground checks on a drop.
- **Enemies** (A32, done): enemy health on return.

## Where it differs from the GDD

- GDD (early): "The Atlas is not built"; later "Built".
- GDD: mines and quarries "will" use Stone; they do.

## Try this (in the tagged build, with the QA panel)

1. **Settle a second place** (or use a save that has one); note a growing
   Stump and a half-done cycle in the first.
2. **Travel**, wait a few minutes, travel back: the Stump hasn't moved on; the
   cycle starts again.
3. **Drop loot on the floor before travelling**: it's banked.
4. **Hurt an enemy, travel and return**: it's whole.
5. Ask yourself: should a Region you left keep going, and should biomes
   matter for what you gather?

## Owner feedback (2026-11-20)

Interviewed without playing first.

- **A Region you left**: stands still, as now.
- **Biomes**: "Biome effects events, and also terrain generation. Different
  areas will have different ranges for water stone and grass." Set per biome
  in the CMS.
- **The four unused biomes**: bring them into the world.
- **Abandoning a place**: never; retire the code.
- **Region rules**: retire. **Stands near**: keep, it's cheap.

## What it became

- **T-613** (director; content agent): each biome sets its terrain ranges, in the CMS.
- **T-614** (content agent): events lean on biome.
- **T-615** (content agent): the four unused biomes come into the world.
- **T-616** (director): Region leftovers (Region rules and abandoning retired, the node's unread biome).
- **T-617** (planning agent): GDD on Regions.
- Fine as is: a left Region stands still; Stands near kept for later.

All five tickets blocked on the living mat group.

## Evidence

- Region record → `src/state/StateSchema.js:94-131`; active board in `state.board` → `src/systems/atlas/Atlas.js:28-34, 536-539`
- Shared: Bank, heroes, Hall and quests travel → `Atlas.js:160-174, 463-472, 528-544`
- Frozen vs running → `Atlas.js:28-34`, `src/systems/core/EngineBootstrap.js:172-222`, `src/systems/events/EventClock.js:20-30`
- On return: cycles from zero, fights cleared → `Atlas.js:448-462`, `src/systems/board/BoardCombat.js:616-621`; loot banked on leaving → `Atlas.js:457-460`
- Ground kinds and words → `src/systems/atlas/TerrainMap.js:19, 35-69`, `src/systems/board/GroundRules.js`; biomes → `src/systems/atlas/Budget.js:54-97`; kits → `data/world.json` (five kits: mountain, forest, meadow, bog, coast)
- Stands on in data → `data/tokens.json` (mines, quarry: stone; Fish Shoal: water); Stands near unused → `src/systems/board/SiteRules.js:29-32`
- Biome unread on nodes → `src/systems/atlas/Cartography.js:122`, `src/systems/board/EffectActions.js:419`
- Region rules, no content → `src/systems/atlas/RegionRules.js:36-48`, `Cartography.js:128-136`, `src/systems/world/cellRegion.js:27-43`
- Archive, restore, abandon, no button → `Atlas.js:396-439`
- GDD → `docs/reference/GDD.md:53-54, 164-169, 1894-1908`
