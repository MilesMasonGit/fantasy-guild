Status: draft

# Basic content: a playable world from camp to midgame

*Opened 2026-10-22 from the owner's Backlog Intake
([research/backlog_intake_2026-10-22.md](research/backlog_intake_2026-10-22.md),
CONTENT-01). To be filled by the content planning agent over several
interview rounds with the owner. The intake's examples are prompts, not
rulings.*

## Why

The Atlas, map generation and the tome are built, but the authored content
is thin and partly placeholder. The owner wants a starter-to-midgame content
set where the whole loop plays: Starter Camp → find a map → settle a Region
→ craft the next tier.

## Scope to interview

1. **The base maps**: which Regions exist early to mid game, each with its
   biome, ground, water and budget (GDD §14: no Region may cost more than the
   reference board).
2. **What lives on each map**: resource nodes, enemy camps, treasure,
   landmarks.
3. **How each map is gained**: enemy drops, bounties, quests, the Shop.
4. **Material tiers by Region**: copper, iron, herbs, hardwood, creature
   drops, and the gear and recipes they unlock.
5. **A playable baseline in the CMS** so the loop can be played and tuned.

## Works with

- [concept_combat.md](concept_combat.md) (enemies, drops) and
  [concept_skill_loops.md](concept_skill_loops.md) (how nodes and stations
  behave): their planning agents run at the same time.
- [concept_atlas.md](concept_atlas.md), [concept_progression.md](concept_progression.md).
- Content is authored only through the CMS: agents propose it as **CMS change
  packs** (brief 200) and the owner reviews each entry. Never hand-edit
  `data/`.

## Owner availability

2026-10-22: the owner is away from the PC for three days (phone only):
design questions yes, screenshots maybe, no CMS review. The change pack waits
in the inbox until the owner is back.

## Decisions

### Round 1 (2026-10-22): the shape

- **Reach: through iron (~level 15).** Two material steps only; mythril,
  silver and gold come in a later content pass. Chosen over gold so the set
  is quick to author and tune while combat is redesigned.
- **Each material step is a plane** (concept_tone_and_world: map tiers are
  planes). Every plane has its own Base Maps; modifiers tune a map (more of a
  node, a camp, a treasure) rather than carry the tier.
  - **Plane 1**: copper and oak, levels 1-14.
  - **Plane 2**: iron and fir, from level 15.
- **Starter Camp: one of each basic** besides the Hall and the 25 endgame
  ruins: a few oak trees, copper and coal veins, a stone outcrop, a berry
  bush, a fishing spot, a wheat patch, a goblin camp. Every Starting skill is
  touched in the first hour; the maps open the bigger versions.
- **First maps: the tutorial gives 3** (Forest, Mountain, Coast). Everything
  after is earned. ⚠️ Today the tutorial's `firstMaps` pays every Base Map
  that no other map upcycles into (all 8); the brief must narrow that.

### Round 2 (2026-10-22): the planes

- **Reuse the 8 existing Base Maps, split by plane**:
  - Plane 1: **Forest, Mountain, Coast, Meadow**; **Flower Meadow and Cherry
    Grove** as rarer plane-1 extras.
  - Plane 2: **Yellowstone** (fir woods), **Volcano** (iron), plus **one new
    plane-2 Base Map** (biome to be decided).
- **Plane-2 maps come only as rare drops from plane-1 enemies** (the tougher
  the enemy, the better the chance). Not chosen: upcycling plane-1 maps,
  guardians, bounties and quests as plane-2 sources. Which enemy drops what,
  and how often, is agreed with the combat planner (see Overlaps).
- **Plane 2 brings iron ore, fir wood, a herb, a creature drop, a fish and a
  crop**: every Starting skill moves up a step, Alchemy gets its first
  content.
- **Plane-2 materials unlock**: iron tools; iron weapons and armour (slots and
  numbers are the combat planner's); better buildings (stations that need fir
  or iron); and Guild Hall upgrades priced in them.

### Round 3 (2026-10-22): where things live

- **The new plane-2 Base Map is the Bog**: murky water, reeds, mist; home of
  the herb, a bog fish (eel) and the wet crop (cranberry). Needs a new ground
  and water look (the terrain code has no bog yet).
- **Every Base Map writes one camp of its own creature.** Every Region has
  something to farm for drops and maps, within GDD §14's ~6 enemies alive.
- **Map supply: enemy drops plus bounties.** Plane-1 enemies drop plane-1
  maps and modifiers steadily and plane-2 maps rarely; bounties keep their
  25 % map payout but draw only plane-1 maps (plane-2 maps get bounty weight
  0).
- **The Starter Camp's goblins drop plane-1 maps** now and then (Forest,
  Mountain, Coast, Meadow), so a player who stays in the camp still gets
  more maps. They don't drop plane-2 maps.

### Round 4 (2026-10-22): the maps' contents

Each map writes at most 64 Tokens at the base cap (`Budget.nodeLimit`: half
the cap is kept for building). Plain names (concept_tone_and_world).

**Plane 1** (copper and oak)

| Base Map | Nodes | Camp | Rarity |
|---|---|---|---|
| Forest | many oak, a few berry bushes | Wolves (new) | tutorial, common |
| Mountain | copper, coal, stone | Goblins and a Goblin Chief (exist) | tutorial, common |
| Coast | fishing spots (shrimp) | Crabs (new) | tutorial, common |
| Meadow | apple trees, wild wheat, berry bushes | Cows (exist, peaceful) | common |
| Flower Meadow | strawberry, blueberry, apple, a beehive | Thorn Elementals (exist, peaceful) | rare |
| Cherry Grove | cherry, peach | Boars (new) | rare |

**Plane 2** (iron and fir)

| Base Map | Nodes | Camp |
|---|---|---|
| Volcano | iron, coal, stone | Rock Elementals (new; also ambush miners on iron veins) |
| Yellowstone | fir, stone, hot springs | Bears (new, hostile): drop the **hide** for leather armour |
| Bog | the herb, eel fishing, cranberry | Bog Toads (new) |

- **Every Base Map writes one small one-time cache** (a ruin or cache that
  bursts loot once, then is gone for good): a handful of that map's
  materials and sometimes a map or modifier. ⚠️ No treasure Token exists;
  the brief must check whether a Token can vanish for good on today's
  Respawns block (concept_atlas §3.3 says ruins deplete permanently).
- **Modifiers in this set**:
  - **More of each basic** (density): Overgrown (trees), Rich Veins (ore),
    Teeming Waters (fish), Bountiful (fruit and crops).
  - **An extra camp per creature** (threat): Wolf Den, Goblin Camp (exists),
    and so on. Watch the ~6 enemies alive.
  - **A treasure modifier**: adds a cache to any Region.
  - **Fir Grove is dropped for now**: turning Forest oak into fir would let
    plane 1 skip plane 2's wood.

## Overlaps with the other planners

- **Combat** ([concept_combat.md](concept_combat.md)): the enemies on each
  plane, their drop tables and the rates at which plane-1 enemies drop
  plane-2 maps; iron weapons and armour (slots, numbers). This doc names
  which plane's enemies drop which materials and maps; the combat planner
  sets the numbers.
- **Naming**: the combat planner's round 1 speaks of a "bronze sword";
  the first metal in the game is **copper** (copper ingots, copper tools).
  Combat gear should follow the item tiers (copper, iron).
- **New creatures for the combat planner to design** (stats, style, drops'
  numbers): Wolves, Crabs, Boars (plane 1); Rock Elementals, Bears, Bog
  Toads (plane 2). Each drops its map's materials, its plane's maps steadily
  and (plane 1 only) plane-2 maps rarely.
- **Skill loops** ([concept_skill_loops.md](concept_skill_loops.md)): how each
  node and station behaves (respawn, groves, veins). This doc says which nodes
  stand on which map; the skill planner says how they work.
