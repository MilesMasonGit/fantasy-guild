Status: draft

# Content roadmap: Construction

*Part of session 4 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's list from the owner's answers, 2026-11-04. Foundations are in [brief 410](briefs/410_shop_detail.md); Construction builds on them. Names and rough levels are decided here; numbers are the ledger's.*

## The owner's rulings (2026-11-04)

- **"Some Stations will be tiered, giving boosts that improve work speed at those stations. Alternatively, we could have a few different versions for stations, that give different benefits. One might boost work speed, another might give a chance of double outputs."**
- **Tiered materials**: later buildings ask for Planks, Nails, cloth and metal parts.
- **Three stone tiers.** "Other kinds of stone will either be cut or used in another skill."
- **Guard Tower and Town Square** join. Today's camps, Mines, Minecarts, Well, Composter, Beehive, Dock and Windmill stay.
- **Kept from before**: Crafting makes items, Construction builds every Token; a better station is a new building, with no upgrade in place; recipes are gated by the skill's level, not the station.

## Costs by tier

| From level | Wood part | Stone | Other parts |
|---|---|---|---|
| 1 | Oak Wood, Oak Plank | Stone | Copper Nails |
| 20 | Fir Plank | Stone | Iron Nails, Canvas, Sack |
| 40 | Maple Plank | Marble | Mythril Nails, Sail, Gears |
| 60 | Mahogany Plank | Marble | Mythril Nails, Drapes, Gears |
| 80 | Ebony Plank | Basalt | Drapes, Gold Ingot |

## Stations

Tiered **Smithy**, with versions of the rest: a base, a **fast** version and a **double output** version. A guild can run both, or pick.

| Station family | Base (level) | Fast version (level) | Double output version (level) | Art |
|---|---|---|---|---|
| **Smithy, five tiers, each faster** | Copper 1, Iron 20, Mythril 40, Adamantine 60, Darkmetal 80 | | | H: five anvils |
| Furnace | Furnace 1 | Forge 25 | Great Forge 55 | H: `smelter`, `forge`, `forge_major` |
| Kitchen | Campfire, Cooking Pot 1 | Kitchen 25 | Grandma's Kitchen 55 | H: `campfire`, `cooking_pot`, `kitchen_cozy`; A |
| Brewery | Brewery 5 | Cellar 30 | Distillery 60 | A, N |
| Workbench | Workbench 1 | Fine Workbench 25 | Master Workbench 55 | H, A, A |
| Tannery | Tannery 10 | Tanning Yard 30 | Master Tannery 60 | H: `shears`; N |
| Loom | Loom 1 | Fine Loom 25 | Grand Loom 55 | N, A, A |
| Fletcher's Bench | Bench 1 | Fine Bench 25 | Master Bench 55 | N, A, A |
| Alchemy Table | Alchemy Table 5 | Alembic 30 | Grand Alembic 60 | H: `alembic_small`; A |
| Enchanting Table | Enchanting Table 1 | Runed Table 30 | Grand Table 60 | H: `enchant`; A |

**32 stations.** ⚠️ Fletching, Tailor and Enchanting need theirs at level 1, because their first recipes are level 1.

## Other buildings

| Group | What | Level | Made with | Art |
|---|---|---|---|---|
| Camps | Logging Camp, Mining Camp, Fishing Hut, Farmstead | 1, later ones with Canvas | Wood, Stone, Canvas | H |
| Excavation | Quarry; Mines for Copper, Iron, Silver, Mythril, Gold, Adamantine, Darkmetal; Coal Mine | at each metal's level | Planks, Stone, Gears from 40 | H: seven `mineshaft_*` |
| Minecarts | One per metal, restocking veins | at each metal's level | Planks, Nails, Gears | H: seven `minecart_*` |
| Farmland | Field, Herb Garden, Orchards, Grapevine, planted Forests | as today | Seeds, Seedlings | H |
| Support | Well, Composter, Beehive, Dock, Windmill | 1 to 25 | Windmill: Gears, Sack. Dock: Sail | H, A |
| **Guard Tower** | Temporary: stops enemy spawns nearby until it wears out | 15 | Planks, Stone, Torches | N |
| **Town Square** | A large late building that boosts many nearby Tokens a little | 85 | Ebony Plank, Basalt, Drapes, Gold Ingot | N |
| Battlefield | The 22 enemy spawners, from their map items | at each enemy's level | as today | H |

## Planning agent's calls

- **The three stones are Stone, Marble and Basalt**, matching your Foundation tiers of 7 October. Granite and Sandstone are cut or go to another skill. Marble comes in at 40, Basalt at 80; Mining's Marble Vein at 45 and Basalt Vein at 85 are placed just after, so level them to suit when balanced.
- **Fast and double output are the two versions** you named. The ledger sets how much.
- **Torches gain their job** on the Guard Tower.
- **Gears and Sails gain jobs**; Wire and Chain stay for Science.
- **Fighter's Academy** retires, as already noted.

## Open links

- ⚠️ **New rule**: a station with a double output chance. The Yield rules may cover it; check when briefed.
- **Foundation tiers** (Oak to Ebony, Stone to Basalt): the older ruling says a better building needs a better Foundation. Whether that still holds, with costs now tiered, is the balance's to say.
- **Clay and Quartz** still have no user.
- **Guard Tower's** rules: combat. **Town Square's** bonus: the ledger.
