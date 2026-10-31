# Brief 330 — The world map: a hex world of origins around the Hall

*Written 2026-10-30 by the planning agent from the owner's workshop of
2026-10-28/29 and answers of 2026-10-30 (requested by the director for the
owner). Concept: [concept_world_map.md](../concept_world_map.md) (read it
whole; the sections dated later win; "Explored and set aside" is the record
of what was **not** chosen). Research behind it: `docs/active/research/`
(the gating journey and games study, the theorycraft, the mat composition
and arrival studies). Replaces map items as the gate to new content and
reshapes the Atlas (built A1–A12).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, the
concept, [concept_progression_ledger.md](../concept_progression_ledger.md)
(the ledger engine this brief extends), [concept_hero_orders.md](../concept_hero_orders.md)
(camps; one hero per job), GDD §3 (spawners, Foundations, Maps), §6
(encounters), §8, §10, §13, §14 (Token cap, one Region runs).

Code to start from (verify): `src/systems/atlas/` (`Atlas.js`, `Budget.js`,
`Layout.js`, `Cartography.js`, `Upcycle.js`, `mapItems.js`,
`regionModifiers.js`, `regionNames.js`, `StarterCamp.js`, `TerrainMap.js`,
`WaterShapes.js`, `seededRandom.js`), `src/ui/components/atlas/`
(`AtlasScreen.jsx`, `AtlasTome.jsx`, `CartographyTable.jsx`,
`ArrivalCard.jsx`, `RegionList.jsx`), `src/systems/board/Foundations.js`,
`src/systems/board/TileModifiers.js` (the "needs one of these in reach"
gate), `src/systems/quests/tutorialQuests.js`, the ledger engine
`src/systems/progression/ledger/` and its CMS tab.

⚠️ **Owner rulings that bind this brief** (all in the concept)
- **Hex cells around the Guild Hall.** The centre is **the Starter Camp,
  permanent** (its authored layout). **Three strict inner rings** (6 + 12 +
  18 = 36 cells) hold **all of the game's content**; **from ring 4 outward,
  generation is wild** (extreme compositions, odd layouts) for min-maxing,
  bringing efficiency, not new content.
- **Six wedges by origin line**, one per hex direction, equal widths, order
  shuffled each run preferring natural neighbours: **Ores** (metals, gems as
  a side output, stone, clay, sand), **Trees**, **Crops**, **Herbs**,
  **Waters**, **Arcane**. Tier rises outward within a wedge; each cell holds
  several materials, its wedge's line as the main one, others blended from
  neighbours. Creatures spread by biome; fish by bait, not place.
- **Every cell's contents are visible from the start** (core outputs and
  requirements); smaller extras (treasures, a rare node, modifiers) stay a
  surprise. **No landmarks**; nothing special marks a new tier.
- **Requirements are paid all at once** (materials from earlier rings and
  skill levels); **costs rise with ring distance**, so something nearer is
  always affordable. **Rules**: key materials within reach of any frontier;
  no iron to reach iron; a price gatherable from one or two settled places.
- **The settled Region arrives occupied**: the mat darkened with **a small
  fixed encounter** (3–6 enemies sized to the ring, sometimes a boss, no
  respawn); clearing every enemy unlocks it. Heroes sent at it keep fighting
  while away as long as they win; a defeated hero waits at the Hall.
- **On a mat**: natural work for **4–6 heroes** (a kit archetype covering most
  skills, plus a specialty that means **better things, not more**); the rest
  comes from what the player builds. **Against luck**: a specialty bag per
  ring, a pity rule (a skill not offered in the last 4 options comes next), a
  value budget per cell (±10 %).
- **Building nodes anywhere**, per skill (the concept's table): Forestry,
  Farming, herbs anywhere on Farmland from their seed; metal mines need a
  **prospecting map** and a **Stone terrain feature**; quarries on Stone,
  clay and sand near water; fishing only on mats with water; Arcane nodes near
  an Arcane node; **a creature's rare drop (a Goblin Banner) builds a copy of
  its camp, the same as the wild one**; built nodes otherwise weaker than wild.
- **Retire**: map items, map drops, bounty map rewards, map upcycling, the
  Cartography slots, the tutorial's three maps. **Keep** modifiers and
  treasures inside generation; the **Atlas tome becomes the world map
  screen**; travel between settled places stays free and instant; places left
  are frozen; a new world each run after the ritual.
- **The tutorial ends with the cartographer opening the world map**: ring 1
  appears, and the last step is "settle your first place".
- **Old saves are abandoned** (owner, 2026-10-30): new games only; no
  conversion.
- **Content comes through the ledger**: which origins sit in which ring of
  each wedge and each cell's price are data in the CMS, priced by the ledger
  (Ores and Trees now; Crops and Herbs when the owner settles them). Nothing
  here waits on content to start.
- **Story sites** (liked in the arrival study) are **not in this brief**: a
  later concept.

## Phases

| Phase | What | Tier |
|---|---|---|
| W1 | **The world and its generation.** A seeded hex world per run: the Hall's cell (the Starter Camp), three strict rings, wild rings beyond; six wedges shuffled with neighbour preference; each cell's origins (wedge line plus blends), tier by ring, kit archetype, specialty; the guarantees (key materials per frontier, the specialty bag and pity rule, the value budget, no iron to reach iron, one-or-two-place prices); requirements from data (the CMS holds the per-wedge, per-ring origin tables and price templates). Pure and deterministic; tests over many seeds. | engineer |
| W2 | **The world map screen.** The tome becomes a hex map: settled cells lit, frontier cells with their core-output icons, hover shows requirements with have/need; **settle** pays all at once and travels there; travel between settled cells as today. Map items, map drops, bounty maps, upcycling and the Cartography slots retired (code and UI). | engineer |
| W3 | **Writing a cell's mat and the arrival.** Settling writes the Region from the cell: the kit archetype for 4–6 heroes, the specialty's better things, hidden extras, wild-ring extremes; a **Stone terrain feature** in the ground (as water is). The mat arrives **darkened** with its small fixed encounter; clearing every enemy brightens it. The tutorial's ending (the world map opens; settle your first place). | engineer |
| W4 | **Building nodes anywhere.** The per-skill rules: seeds and seedlings on Farmland; metal mines from a prospecting map on Stone terrain; quarries on Stone, clay and sand near water; fishing only on water mats; Arcane nodes near an Arcane node; a creature's banner builds its camp the same as wild; built nodes weaker (the numbers are data). Today's Copper Mine, Coal Mine and Quarry change to these rules. | builder (engineer if placement rules need engine work) |
| W5 | **The ledger meets the world.** Wedge and ring on origins; the **World plan** view (the hex grid by wedge and ring, cell contents, problems overlaid); checks F (a ring-N cell asking ring-N materials, key materials not guaranteed per frontier, the inner rings not covering every Live entry, an origin with no wedge, a cell's value off by more than ±10 %); generating many worlds and reporting per-skill bands and price spreads. | engineer |
| W6 | **The first world content pack** (through the ledger gate): Ores and Trees origins by ring, placeholder lines for Crops, Herbs, Waters and Arcane, the kit archetypes, price templates per ring, arrival encounters per ring, prospecting maps and creature banners as drops, seeds where missing. | builder |

## Done when

- Gate green each phase (`TESTING.md`); the engine bench's scenarios change
  (new worlds): the director re-baselines and records it.
- In the running game: a new game starts on the Starter Camp; the tutorial
  ends with the world map opening; ring 1's cells show their outputs and
  requirements; settling one pays, travels, and shows a darkened mat whose
  goblins, once beaten, brighten it; iron appears on ring 2 within reach
  whichever way the guild went; a prospecting map lets a Copper Mine be built
  only on Stone terrain; a Goblin Banner builds a Goblin Camp.
- In the CMS: the World plan shows the generated world for a seed; 100 seeds
  pass checks F, or the failures are listed.
- Eye-checks: W2 with W3 (one look at the map and an arrival), W4, and the
  owner's review of W6's pack.

## Owner to-do

- Review W6's pack; settle Crops' and Herbs' tiers when ready (they slot into
  the same tables).
- Art when ready: hex cell frames and core-output icons, the darkened-mat
  look, Stone terrain pieces, a prospecting map and banner items (code-drawn
  stand-ins until then).
