Status: draft

# Content roadmap: Mining and Forestry Tokens

*Part of the gathering sessions of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's ideas, 2026-11-04, for the owner to edit. Levels are rough; yields and timings are the ledger's.*

## The owner's ruling (2026-11-04)

"Forestry doesn't really have an item chain progression like the others... Same with Mining. For these, I think we could try coming up with some creative tokens to practice these skills on. They have big gaps between tiers, and we could put a couple interesting resources in there, such as Clay and Quartz for Mining."

So the metals and woods stay on their 20-level tiers, and **the gaps hold Tokens that play a little differently or supply something another skill needs**. Tokens don't use up a recipe level.

**Bold** names are new ideas. Art: H have, A adapt, N new.

## Mining

| Level | Token | Gives | Its job | What's different | Art |
|---|---|---|---|---|---|
| 1 | Copper Ore Vein, Coal Vein, Stone Outcrop | Copper Ore, Coal, Stone | Smithing, Construction | The everyday rhythm | H |
| 8 | Clay Deposit | Clay | ⚠️ none yet: Construction? | Quick, soft, refills fast | H |
| 12 | Quartz Deposit | Quartz | ⚠️ none yet: Science? | Slow, gives a lot | H |
| 15 | **Geode** | Uncut Topaz, Ruby, Sapphire | Crafting's gems, Enchanting's Staffs | Cracks open in one big burst, then rests a long time | N |
| 20 | Iron Ore Vein | Iron Ore | Smithing | | H |
| 25 | Granite Vein | Granite | Construction's better buildings | | H |
| 30 | Silver Ore Vein | Silver Ore | Smithing | | H |
| 35 | **Crystal Cluster** | Uncut Emerald, Amethyst | Crafting's gems | Each swing may shatter it; a careful hero gets more | N |
| 40 | Mythril Ore Vein | Mythril Ore | Smithing | | H |
| 45 | Marble Vein | Marble | Construction's fine buildings | | H |
| 50 | Gold Ore Vein | Gold Ore | Smithing | | H |
| 55 | **Diamond Seam** | Uncut Diamond | Crafting's gems | Very slow, rare, and always pays | N |
| 60 | Adamantine Ore Vein | Adamantine Ore | Smithing | | H |
| 65 | Basalt Vein | Basalt | Construction's late buildings | Near volcanoes | H |
| 70 | **Fallen Star** | Adamantine and Darkmetal Ore | A head start on the next metal | A rare find on the map; one rich strike, then gone | N |
| 80 | Darkmetal Ore Vein | Darkmetal Ore | Smithing | | H |
| 90 | **Fossil Bed** | Bones, Dragon Scales | Crafting's Dragonscale, an alternative to fighting for it | Slow digging, big finds | N |

## Forestry

| Level | Token | Gives | Its job | What's different | Art |
|---|---|---|---|---|---|
| 1 | Oak Tree | Oak Wood, Oak Seedling, Bird Nest (rare) | Everything | The everyday rhythm | H |
| 5 | **Fallen Log** | Oak Wood | Wood with no axe, or for a Rusty Woodaxe's first minutes | Worked bare-handed, a few uses, gone | H (`oak_fallen`) |
| 10 | **Hollow Tree** | Feathers, Bird Nests | Fletching's Feathers | Doesn't fall; birds come and go, so it pays in bursts | N |
| 20 | Fir Tree | Fir Wood, Fir Seedling | Fletching, Smithing, Enchanting | | H |
| 25 | **Sap Pine** | Resin | ⚠️ needs a user: Torches? | Tapped, not chopped; slow and steady, never falls | N |
| 30 | Birch Tree | Birch Wood, Birch Seedling | Enchanting, Construction | | H |
| 35 | **Webbed Tree** | Silk | Tailor's Silk, before spiders | Must be cleared of spiders first: a small fight | N |
| 40 | Maple Tree | Maple Wood, Maple Seedling | Fletching, Smithing, Enchanting | | H |
| 50 | Cedar Tree | Cedar Wood, Cedar Seedling | Enchanting, Construction | | H |
| 55 | **Amber Tree** | Amber | ⚠️ needs a user: Enchanting? | Ancient, slow, drips rare Amber | N |
| 60 | Mahogany Tree | Mahogany Wood, Mahogany Seedling | Fletching, Smithing, Enchanting | | H |
| 70 | **Ironbark** | Mahogany and Ebony Wood | A head start on the next wood | Very tough: takes a long time per swing, but pays heavily | N |
| 80 | Ebony Tree | Ebony Wood, Ebony Seedling | Fletching, Smithing, Enchanting | | H |
| 90 | **Forest Shrine** | Nature Motes, Ebony Seedlings | A link to Enchanting at the very top | Tended rather than chopped | H (`shrine_forest`) |

## What this changes

- **Metals and woods move to the 20-level tiers**: today's veins and trees ask for 15, 30, 45, 60, 75 and 90 (world tables and CMS, T-294).
- **Clay, Quartz, Resin and Amber have no user yet.** By the no-clutter rule, each needs a job from Construction, Science, Alchemy or Enchanting, or it goes.
- **Tailor's Silk** gains a Forestry source, as well as spiders.
- **Woodaxes**: Ironbark and Ebony could be the first trees to need a better axe, giving them a reason, if you want axes to gate.
- **New behaviours** (a burst, a shatter chance, tapping, a fight first) are Token rules; some exist, some are new. Each needs checking when it's briefed.
