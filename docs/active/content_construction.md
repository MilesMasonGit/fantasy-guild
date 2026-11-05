Status: draft

# Content roadmap: Construction

*Part of session 4 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's list from the owner's answers, 2026-11-04. Foundations are in [brief 410](briefs/410_shop_detail.md); Construction builds on them. Names and rough levels are decided here; numbers are the ledger's.*

## The owner's rulings (2026-11-04)

- **"Some Stations will be tiered, giving boosts that improve work speed at those stations. Alternatively, we could have a few different versions for stations, that give different benefits. One might boost work speed, another might give a chance of double outputs."**
- **"We'll replace Smithy and Furnace with a single Blacksmith. I want a very clear Building for each skill that needs it. The higher tiers are variants. I also want these to be structures, not pieces of furniture. We should start by making those basic Stations, then we'll make the variants."**
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

**Later, with their sessions**: Faith, Summoning, Science, Crime and Taming, if they need one.

## Variants, to design next

"The higher tiers are variants." Each building later gets variants with different benefits: for example faster work, or a chance of double outputs. Not listed until the basic buildings are settled.

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
- **Each skill's stations fold into one building**: food and drinks both at the Kitchen; ingots and gear both at the Blacksmith; leather at the Workshop. Names are suggestions.
- **Torches gain their job** on the Guard Tower.
- **Gears and Sails gain jobs**; Wire and Chain stay for Science.
- **Fighter's Academy** retires, as already noted.

## Open links

- ⚠️ **One building a skill changes today's rules**: recipes are split by station kind (`stationKinds`), and the tutorial, ledger and Starter Camp name today's stations. **Art**: seven new structures; today's pictures stand in until drawn.
- **Variants** may use a double output chance; the Yield rules may cover it, to check when designed.
- **Foundation tiers** (Oak to Ebony, Stone to Basalt): the older ruling says a better building needs a better Foundation. Whether that still holds, with costs now tiered, is the balance's to say.
- **Clay and Quartz** still have no user.
- **Guard Tower's** rules: combat. **Town Square's** bonus: the ledger.
