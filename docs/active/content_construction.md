Status: approved 2026-11-04 (Planned entries staged 2026-11-26 in the `2026-11-26-planned-*` packs, T-305; the owner reviews and Syncs)

# Content roadmap: Construction

*Part of session 4 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's list from the owner's answers, 2026-11-04. Foundations are in [brief 410](briefs/410_shop_detail.md); Construction builds on them. Names and rough levels are decided here; numbers are the ledger's.*

## The owner's rulings (2026-11-04)

- **"Some Stations will be tiered, giving boosts that improve work speed at those stations. Alternatively, we could have a few different versions for stations, that give different benefits. One might boost work speed, another might give a chance of double outputs."**
- **"We'll replace Smithy and Furnace with a single Blacksmith. I want a very clear Building for each skill that needs it. The higher tiers are variants. I also want these to be structures, not pieces of furniture. We should start by making those basic Stations, then we'll make the variants."**
- **Tiered materials**: later buildings ask for Planks, Nails, cloth and metal parts.
- **Three stone tiers.** "Other kinds of stone will either be cut or used in another skill."
- **Guard Tower and Town Square** join. Today's camps, Mines, Minecarts, Well, Composter, Beehive, Dock and Windmill stay.
- **"Basic buildings for other skills as well. For example, we'll want to have a Logging camp that allows the hero to work all trees in the nearby radius."**
- **One War Camp for all combat styles. No building for Construction.**
- **Kept from before**: Crafting makes items, Construction builds every Token; a better station is a new building, with no upgrade in place; recipes are gated by the skill's level, not the station.

## Amended 2026-11-12 (owner, [brief 630](briefs/630_building_upgrades.md))

- Base buildings carry **no effect**; the variants are the upgrades.
- The variant menu uses the effect names (UI_STYLE): Speed, Preservation, Double Loot, Growth, Lucky, XP; **Wider Reach is gone** (one standard reach, brief 560) and becomes **Refresh**; Efficiency and Abundance join. The content agent redraws the variant table below for the owner to approve.
- **One Neighbours variant per skill**: Speed to nearby Tokens of the skills it trades with.
- XP stays on the planned skill variants (Barracks, Arcane Library, Master's Study).

## Costs by tier

| From level | Wood part | Stone | Other parts |
|---|---|---|---|
| 1 | Oak Wood, Oak Plank | Stone | Copper Nails |
| 20 | Fir Plank | Stone | Iron Nails, Canvas, Sack |
| 40 | Maple Plank | Marble | Mythril Nails, Sail, Gears |
| 60 | Mahogany Plank | Marble | Mythril Nails, Drapes, Gears |
| 80 | Ebony Plank | Basalt | Drapes, Gold Ingot |

## Skill buildings

**One clear building per skill that needs one, a structure and not a piece of furniture.** These come first; variants come after (below).

*This list (17 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Construction. The rulings and reasoning stay on this page.*

**Construction has no building** (owner): a hero goes to each Foundation. The five specialist buildings are placeholders; their sessions may change what they do.

## Variants

"The higher tiers are variants." **Every building won't have every type; each picks from this menu** (owner, 2026-11-04).

| Type | What it does | Suits | In the game today? |
|---|---|---|---|
| **Faster Work** | Work here takes less time | any | to check |
| **Double Output** | A chance of two from one | craft buildings, camps | yes: Double Item Chance |
| **Save Materials** | A chance not to spend ingredients | craft buildings | to check |
| **More XP** | Work here pays extra XP | any | to check |
| **Wider Reach** | A larger radius of work | camps, War Camp | to check |
| **Quick Refill** | Nearby veins, trees and water rest less | gathering camps | to check |
| **Rare Finds** | More gems, nests, rare catches or drops from work nearby | camps, War Camp | to check |

**Not taken**: Second Worker, Works on Its Own, Auto Collect.

**Proposed variants** (names are suggestions). Levels follow the tiers: 20, 40, 60, with 80 left for later. A variant is built on its own new Foundation and is an option beside the base building, not a replacement.

| Building | From 20 | From 40 | From 60 |
|---|---|---|---|
| Blacksmith | Foundry: Faster Work | Master Smithy: Save Materials | Grand Forge: Double Output |
| Kitchen | Bakehouse: Faster Work | Brewery: Double Output | Banquet Hall: Save Materials |
| Workshop | Guild Workshop: Faster Work | Tannery: Save Materials | Jeweller's Hall: Double Output |
| Tailor's Shop | Weaving Hall: Faster Work | Clothier's: Save Materials | Royal Atelier: Double Output |
| Fletcher's Lodge | Bowyer's Hall: Faster Work | Arrow Works: Double Output |  |
| Apothecary | Herbalist's Hut: Save Materials | Alchemist's Hall: Double Output | Master's Study: More XP |
| Enchanter's Tower | Arcane Library: More XP | Runed Spire: Save Materials | Grand Spire: Faster Work |
| Logging Camp | Sawmill: Double Output | Forester's Lodge: Wider Reach | Grovekeeper's Hut: Quick Refill |
| Mining Camp | Mine Head: Quick Refill | Prospector's Camp: Rare Finds | Deep Workings: Wider Reach |
| Fishing Hut | Pier: Wider Reach | Bait Shop: Rare Finds | Fish Market: Double Output |
| Farmstead | Barn: Double Output | Greenhouse: Quick Refill | Manor Farm: Wider Reach |
| War Camp | Barracks: More XP | Hunting Lodge: Rare Finds | Fortress: Wider Reach |

**35 variants.** Art you may already have: `sawmill`, `market_fish`, `greenhouse`, `shrine_forge_major`, `forge_major`. The rest are new structures, or adapted from their base building. Specialist skills' variants come with their sessions.

## Other buildings

*This list (7 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Construction. The rulings and reasoning stay on this page.*

## Planning agent's calls

- **The three stones are Stone, Marble and Basalt**, matching your Foundation tiers of 7 October. Granite and Sandstone are cut or go to another skill. Marble comes in at 40, Basalt at 80; Mining's Marble Vein at 45 and Basalt Vein at 85 are placed just after, so level them to suit when balanced.
- ⚠️ **War Camp is a new rule**: a hero fighting everything in reach, like a camp working its trees. Check it against the arrival fights and Guard Towers when briefed.
- **Each skill's stations fold into one building**: food and drinks both at the Kitchen; ingots and gear both at the Blacksmith; leather at the Workshop. Names are suggestions.
- **Torches gain their job** on the Guard Tower.
- **Gears and Sails have their jobs from level 40**, in the costs above. They stay off the Windmill and Dock, which come first: Bread needs the Windmill's Flour early.
- **Fighter's Academy** retires, as already noted.

## Open links

- ⚠️ **One building a skill changes today's rules**: recipes are split by station kind (`stationKinds`), and the tutorial, ledger and Starter Camp name today's stations. **Art**: seven new structures; today's pictures stand in until drawn.
- **Variants** may use a double output chance; the Yield rules may cover it, to check when designed.
- **Foundation tiers** (Oak to Ebony, Stone to Basalt): the older ruling says a better building needs a better Foundation. Whether that still holds, with costs now tiered, is the balance's to say.
- **Clay and Quartz** still have no user.
- **Guard Tower's** rules: combat. **Town Square's** bonus: the ledger.

## Building it (2026-11-21, content agent)

- **The base buildings take over today's first station of each skill, in place**: Furnace becomes Blacksmith, Cooking Pot becomes Kitchen, Workbench becomes Workshop, Alchemy Table becomes Apothecary. Their ids are kept and pinned, so saves and the first lesson's Workbench step keep working. The Apothecary builds at Construction 1 from Oak Wood and Stone, so Alchemy starts at 1.
- **The old split stations go with the variants**, not before: their Build recipes are also Construction's early XP, and the Kitchen's speed carries Cooking's pace; the pack gate showed each alone slows Plane 1 and 2 past tolerance. The variants pack retires them as the variants take their place (Iron Smithy and Iron Furnace to the Foundry, Brewery and Tannery to their namesakes, Fir Workbench to the Guild Workshop).

## The variant table (approved by the owner 2026-11-21, brief 630 C2)

Redrawn with the effect names. Each variant is a building of its own beside the base, built from Construction 20, 40 and 60 (80 left for later); one Neighbours variant per skill speeds nearby work in the skills it trades with.

| Building | 20 | 40 | 60 | Neighbours (20): speeds nearby |
|---|---|---|---|---|
| Blacksmith | Foundry: Speed | Master Smithy: Preservation | Grand Forge: Double Loot | Smiths' Row: Mining, Forestry |
| Kitchen | Bakehouse: Speed | Brewery: Double Loot | Banquet Hall: Efficiency | Market Kitchen: Farming, Fishing |
| Workshop | Guild Workshop: Speed | Tannery: Preservation | Jeweller's Hall: Double Loot | Craftsmen's Yard: Forestry, Mining |
| Apothecary | Herbalist's Hut: Preservation | Alchemist's Hall: Double Loot | Master's Study: XP | Physic Garden: Farming |
| Logging Camp | Sawmill: Double Loot | Forester's Lodge: Refresh | Grovekeeper's Hut: Growth | Timber Yard: Crafting, Smithing |
| Mining Camp | Mine Head: Growth | Prospector's Camp: Lucky (after T-336) | Deep Workings: Refresh | Ore Market: Smithing, Crafting |
| Fishing Hut | Pier: Refresh | Bait Shop: Lucky (after T-336) | Fish Market: Double Loot | Fishmonger's: Cooking |
| Farmstead | Barn: Double Loot | Greenhouse: Growth | Manor Farm: Abundance | Farmers' Market: Cooking, Alchemy |

The Fletcher's Lodge, Enchanter's Tower, Tailor's Shop and War Camp get theirs with their buildings.

**Built (pack `2026-11-21-construction-variants`)**: the table above but the Lucky ones; today's Iron Smithy, Fir Workbench, Brewery and Tannery become the Foundry, Guild Workshop, Brewery and Tannery in place (ids kept, so built ones keep working); the Copper Smithy and Iron Furnace retire; the Kitchen's speed moves to the Bakehouse. Costs by tier: Fir Plank, Stone and Iron Nails from 20; Maple Plank, Marble, Mythril Nails and Iron Gears from 40; Mahogany Plank, more Marble, Nails and Gears from 60 (Tailor's cloth joins when Tailor comes). Marble and Basalt Veins, Iron Gears; Forests build at their wood's level; the Town Square at 85 (every Token in reach 5% faster). Numbers are first values for the ledger.

## Construction's own work (2026-11-21)

*Owner, 2026-11-21 (T-656): Construction earns from builds and from repeatable work; the work is **building parts at a Builder's Yard**, used by later builds.*

- **The Builder's Yard** is Construction's own building (Construction 1, Oak Wood and Stone, like the Apothecary). It works as a Construction station, and its list holds only parts: the Build recipes stay on Foundations.
- **Parts**: Cut Stone (1, from Stone), Roof Tiles (10, from Clay), Fir Frame (20, Fir Planks and Iron Nails), Maple Frame (40, Maple Planks and Mythril Nails), Marble Block (45, Marble), Mahogany Frame (60, Mahogany Planks and Mythril Nails), Ebony Frame (80) and Basalt Block (85) for the Town Square. Entries in the catalogue.
- **Costs by tier now ask parts** in place of raw Planks, Stone and Nails: at 20, 3 Fir Frames, 4 Cut Stone and 2 Roof Tiles; at 40, 3 Maple Frames, 4 Marble Blocks, 3 Roof Tiles and 2 Iron Gears; at 60, 3 Mahogany Frames, 6 Marble Blocks, 4 Roof Tiles and 4 Iron Gears; the Town Square 6 Ebony Frames, 8 Basalt Blocks and 10 Gold Ingots. Level 1 builds keep raw materials, so the Starter Camp is unchanged. Canvas, Sack, Sail and Drapes join with Tailor.
- **Pace**: with the parts, the ledger shows Construction on pace to 20 and to 85 (it was 4x and 8x behind). Builds keep their XP for now: pricing each build by its materials' gathering hours (BALANCE_RULES section 1) wants the ledger to price it, so that is the ledger's to propose.

