Status: briefed (brief 240; approved 2026-10-24)

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

## The world at a glance (current, after round 9)

*The rounds below record how each decision was reached; where they differ,
this table wins.* Plain names; every entry has existing art unless marked.

**Starter Camp** (~30 min): the Hall, the 25 endgame ruins, a few oak trees,
copper and coal veins, a stone outcrop, a berry bush, a fishing spot, a wheat
patch, a Goblin Camp. Ends when the player has made a first copper tool and
beaten a goblin: the cartographer hands over Forest, Mountain and Coast.

**Plane 1** (copper and oak; ~1.5 h; levels 1-15)

| Base Map | Nodes | Camp | Boss (first kill: a plane-2 map) | Rarity |
|---|---|---|---|---|
| Forest | many oak, a few berry bushes | Wolves | Wolf Alpha (bigger wolf) | tutorial |
| Mountain | copper, coal, stone | Goblins | Goblin Chief | tutorial |
| Coast | fishing spots (shrimp) | Crabs | Water Elemental | tutorial |
| Meadow | apple trees, wild wheat, berry bushes | Cows (peaceful) | Greater Slime | common |
| Flower Meadow | strawberry, blueberry, apple | Thorn Elementals (peaceful) | Wind Elemental | rare |
| Cherry Grove | cherry, peach | Bees (drop honey) | Queen Bee (bigger bee) | rare |

Makes: copper tools, copper weapons and armour, cooking from meat, fish and
fruit. Caches: copper chests.

**Plane 2** (iron and fir; ~1 day; everything new at level 15)

| Base Map | Nodes | Camp | Boss (good loot; plane-3 maps later) |
|---|---|---|---|
| Volcano | iron, coal, stone | Fire Elementals (also ambush miners on iron) | Fire Elemental chief (tinted) |
| Yellowstone | fir, stone, grapevines, hot springs | Sulphur Lizards (drop Lizard Scale) | Big Lizard |
| Bog | Lavender (the herb), trout fishing | Frogs | Toxic Frog |

Makes: iron tools, weapons and armour (Iron Anvil); leather boots, gloves and
tunic from Lizard Scale (Tannery); a healing potion from Lavender (Alchemy
Table); better Furnace (smelter) and Workbench from fir and iron. Caches:
iron chests. Bog banner: the existing swamp map; the Bog's ground and water
look is new (code).

**Map flow**: the tutorial gives 3; every enemy drops its plane's maps and
modifiers steadily; plane-1 enemies drop plane-2 maps rarely; each plane-1
boss's first kill always drops one; bounties pay plane-1 maps only.
**Modifiers**: Overgrown, Rich Veins, Teeming Waters, Bountiful (more of a
basic); a Wolf Den, Goblin Camp etc. per creature (an extra camp); a
Treasure modifier (a cache). Fir Grove is dropped.

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

### Round 5 (2026-10-22): the crafting chain

- **Every plane-2 node and recipe opens at level 15**: iron ore (Mining),
  fir (Forestry), eel (Fishing), cranberry (Farming), iron ingot (Smithing,
  as today); the Marsh Herb at Alchemy 1 (Alchemy starts there). One clear
  number to chase in plane 1.
- **Copper tools work plane 2**: copper pick for iron (the standing rule: an
  ore needs the pick of the step below), copper axe for fir, the fishing rod
  for eel, the copper sickle for cranberry and the herb. Iron tools are made
  in plane 2, ready for the next plane.
- **Plane-2 buildings**: **Iron Anvil** (iron ingots; smiths iron tools,
  weapons, armour), **Tannery** (fir; Bear Hide → leather, Crafting),
  **Alchemy Table** (fir and stone; Marsh Herb → healing potion; what a
  potion does in a fight is the combat planner's), and **better plane-1
  stations** (a Fir Workbench, a better Furnace) built from fir and iron, so
  the move is also a rebuild.
- **Plain names**: **Marsh Herb, Eel, Cranberry, Bear Hide** (a later herb
  would be e.g. Mountain Herb).

### Round 6 (2026-10-22): gear, upgrades, pace

- **Plane 1 makes copper weapons and armour** at the anvil; wolf, boar and
  crab drops feed Cooking (meat). Leather starts with plane 2's Bear Hide.
- **Guild Hall upgrade prices follow the planes**: the first 2 ranks of each
  upgrade (Token cap, Cartography slots) in oak, stone and copper; ranks 3-4
  in fir and iron; later ranks wait for later planes.
- **Content past iron stays as it is**: silver to darkmetal, birch to ebony,
  the tropical fruit trees and the rest stay in the CMS untouched; no map in
  this set writes them, so players never meet them. Nothing is deleted.

### Round 7 (2026-10-22): plane 1 is the tutorial

- **The Starter Camp and plane 1 together take about 2 hours from a new
  game** (owner: "Plane 1 is the tutorial"): the camp about 30 minutes, plane
  1 about 1.5 hours, then the first plane-2 Region.
- **Fast early levels**: levels 1-15 come quickly (a level every few minutes
  in the skills being worked), and the curve slows from plane 2 on. Target:
  about 15 in the main skills after ~2 hours. The curve itself is the skill
  planner's (see Overlaps).
- **The first plane-2 map is guaranteed from a plane-1 milestone enemy**:
  each plane-1 camp has a tougher leader (like the Goblin Chief) whose first
  kill always drops a plane-2 map; later kills drop one sometimes. Ordinary
  plane-1 enemies drop plane-2 maps rarely (round 2). This amends round 2's
  "only as rare drops".
- **Plane 2 lasts about a day.** Each plane gets longer step by step (about
  2 hours, about a day, then longer); the next plane is a later content pass.
- ⚠️ **Amends [concept_progression.md](concept_progression.md)**: its
  "Starter Camp lasts about 30-60 minutes" becomes about 30 minutes, and its
  "moves every few days" rhythm starts after plane 2, not from the first
  map. The first ritual's 1-3 months is unchanged.

### Round 8 (2026-10-24): bosses, art, the camp's end, packs

- **Every Base Map may have a "boss" unrelated to its camp** (owner: "a
  flower golem that roams the meadow, for example"), so peaceful maps lead on
  to plane 2 too. The boss's first kill is the guaranteed plane-2 map.
- **Art: use placeholders, or re-theme to match existing art** (owner: e.g.
  redberry instead of cranberry). Re-theming wins wherever a sprite exists
  (round 9); anything left takes the nearest sprite, flagged placeholder art
  in the pack.
- **The Starter Camp ends at the first copper tool plus a goblin beaten**;
  then the cartographer hands over the 3 maps. The exact tutorial steps are
  [concept_quests_tutorial.md](concept_quests_tutorial.md)'s (D8).
- **Three change packs**: (1) Starter Camp and plane 1, (2) plane 2,
  (3) modifiers, caches and Hall prices. Plane 1 can be played before plane
  2 is accepted.

### Round 9 (2026-10-24): re-themed to existing art

- **Plane-1 bosses**: Wolf Alpha (Forest), Goblin Chief (Mountain), Water
  Elemental (Coast), Greater Slime (Meadow), Wind Elemental (Flower Meadow),
  Queen Bee (Cherry Grove). Cherry Grove's boars become **Bees** (drop
  honey); Flower Meadow's beehive node is dropped.
- **Plane 2 re-themed**: Marsh Herb → **Lavender**, Eel → **Trout**,
  Cranberry → **Grapes** (grapevines on Yellowstone), Rock Elementals →
  **Fire Elementals**, Bog Toads → **Frogs**.
- **Yellowstone: Sulphur Lizards drop Lizard Scale**; the Tannery turns
  scales into leather for boots, gloves and a tunic (replaces Bear Hide).
- **Plane-2 maps get bosses too**, with good loot now (extra materials,
  modifiers) and plane-3 maps once that plane exists: a tinted Fire Elemental
  chief, a Big Lizard, a Toxic Frog.

### Round 10 (2026-10-24): authoring, and closed

- **The Starter Camp's new basics: an agent proposes, the owner
  rearranges.** Change packs learn to carry the Starter Camp (small CMS
  change); the owner can move anything and re-save it.
- **Numbers: the agent drafts, the owner tunes by playing.** Each first-pass
  number is noted in the pack.
- **Bosses stay near their spot** (a lair of one, pottering like other
  enemies); roaming the whole map can come later.
- **Closed** (owner: "Yes, write the brief"): briefed as
  [brief 240](briefs/240_basic_content.md).

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
  numbers): Wolves, Crabs, Bees (plane 1); Fire Elementals, Sulphur
  Lizards, Frogs (plane 2); and the nine bosses in the table above. Each drops its map's materials, its plane's maps steadily
  and (plane 1 only) plane-2 maps rarely.
- **Leaders (combat)**: every plane-1 camp needs a tougher leader whose
  first kill always drops a plane-2 map (the Goblin Chief exists; wolves,
  crabs and bees need one; round 9 named them all, as bosses in lairs per
  brief 220 C5). Their stats are the combat planner's.
- **The XP curve (skill loops)**: levels 1-15 in about 2 hours of play, then
  slower. Today's speed and XP numbers are the skill planner's to set.
- **Skill loops** ([concept_skill_loops.md](concept_skill_loops.md)): how each
  node and station behaves (respawn, groves, veins). This doc says which nodes
  stand on which map; the skill planner says how they work.
