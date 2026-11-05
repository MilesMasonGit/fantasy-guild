Status: approved 2026-11-04 (a CMS pack of Planned entries still to come)

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

| Skill | Building | Level | Replaces today | Art |
|---|---|---|---|---|
| Smithing | **Blacksmith** | 1 | Furnace, Copper and Iron Smithy, Iron Furnace | N |
| Cooking | **Kitchen** | 1 | Campfire, Cooking Pot, Brewery | N (`kitchen_cozy` may adapt) |
| Crafting | **Workshop** | 1 | Workbench, Fir Workbench, Tannery | N |
| Tailor | **Tailor's Shop** | 1 | new | N |
| Fletching | **Fletcher's Lodge** | 1 | new | N |
| Alchemy | **Apothecary** | 1 | Alchemy Table | N |
| Enchanting | **Enchanter's Tower** | 1 | new | N |
| Forestry | Logging Camp | 1 | stays: a hero works every tree nearby | H |
| Mining | Mining Camp | 1 | stays: a hero works every vein nearby | H |
| Fishing | Fishing Hut | 1 | stays: a hero works every water nearby | H |
| Farming | Farmstead | 1 | stays: a hero works every field and bush nearby | H |
| Melee, Ranged, Magic, Stealth | **War Camp** | 1 | new: a hero there fights every enemy nearby, in their own style | N |
| Faith | **Chapel** | its session | placeholder | N |
| Summoning | **Summoning Circle** | its session | placeholder | N |
| Science | **Laboratory** | its session | placeholder | N |
| Crime | **Hideout** | its session | placeholder | N |
| Taming | **Stable** | its session | placeholder | N |

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

| Group | What | Level | Made with | Art |
|---|---|---|---|---|
| Excavation | Quarry; Mines for Copper, Iron, Silver, Mythril, Gold, Adamantine, Darkmetal; Coal Mine | at each metal's level | Planks, Stone, Gears from 40 | H: seven `mineshaft_*` |
| Minecarts | One per metal, restocking veins | at each metal's level | Planks, Nails, Gears from 40 | H: seven `minecart_*` |
| Farmland | Field, Herb Garden, Orchards, Grapevine, planted Forests | as today | Seeds, Seedlings | H |
| Support | Well, Composter, Beehive, Dock, Windmill | 1 to 25 | Windmill: Oak Plank, Stone. Dock: Oak Plank | H, A |
| **Guard Tower** | Temporary: stops enemy spawns nearby until it wears out | 15 | Planks, Stone, Torches | N |
| **Town Square** | A large late building that boosts many nearby Tokens a little | 85 | Ebony Plank, Basalt, Drapes, Gold Ingot | N |
| Battlefield | The 22 enemy spawners, from their map items | at each enemy's level | as today | H |

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
